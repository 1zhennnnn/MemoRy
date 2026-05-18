# MemoRy — Claude Code 專案指引

## 專案一句話說明
MemoRy 是 AI 碎片化知識管理系統，由 **Chrome Extension（MV3）** + **Web Dashboard（React）** + **Express 5 API Server** 組成的 pnpm Monorepo，部署於 Replit。

---

## 目前進度（Phase 狀態）

| Phase | 名稱 | 狀態 |
|-------|------|------|
| 0 | 基礎設施 | ✅ 完成 |
| 1 | 後端 API 路由實作 | ✅ 完成 |
| 2 | AI 整合（Gemma） | ✅ 完成 |
| 3 | Chrome Extension 核心 | ✅ 完成 |
| 4 | Web Dashboard MVP | ✅ 完成 |
| 5 | 進階功能 | 🔄 進行中 |
| 6 | 品質與部署 | ⏳ 待開始 |

**當前任務**：Phase 5 — 進階功能

### Phase 5 已完成項目
- **暗/亮模式**：`globals.css` 雙主題 CSS 變數（`[data-theme="dark/light"]`），`src/shared/theme.ts` 管理，TopBar 切換按鈕
- **新增筆記頁面**（`/new`）：文字輸入 tab（textarea + URL + 備注）+ 圖片上傳 tab（拖曳/點選，base64 → OCR）
- **Web Dashboard 圖片上傳**：`api.notes.createImage()` → `POST /api/notes/image`
- **字型放大**：全站 font-base 從 13px → 15px
- **Chrome Extension 快捷鍵**：`Alt+Shift+S`（儲存選取）、`Alt+Shift+P`（截圖）、`Alt+Shift+A`（整頁文字）
- **MemoRy Logo**：去背版整合至所有位置（Dashboard + Extension），3 種 icon 尺寸
- **Chrome Extension icon 修正**：圖示移至 `public/icons/` 確保 Vite 正確複製至 dist
- **Monica 側欄模式**：`chrome.sidePanel` API，點擊 Extension icon 開啟右側側欄（Chrome 114+）
- **整頁文字擷取**：`SAVE_PAGE_TEXT` 訊息 → 注入腳本抽取 `body.innerText`（保留圖片 alt），圖文頁面也能正常儲存
- **Token 自動刷新**：`chrome.alarms` 每 45 分鐘刷新，`CHECK_AUTH` 時也刷新，解決重複要求登入問題
- **Toast 修正**：改用 `executeScript` 直接注入 toast，不依賴 content script 是否載入

---

## 已完成的基礎設施（Phase 0）

以下檔案已存在且可直接使用，**勿重建或覆蓋**：

```
memory/
├── lib/db/src/schema/         ← DB Schema 已完成
│   ├── notes.ts               ← vectorColumn customType 已設定
│   ├── tags.ts
│   └── daily_reports.ts
├── lib/api-spec/openapi.yaml  ← OpenAPI 契約（17 端點）已完成
├── lib/api-zod/src/generated/ ← Orval codegen 產出，勿手動編輯
├── artifacts/api-server/src/
│   ├── app.ts                 ← Express 5 app 已設定
│   ├── routes/index.ts        ← 路由掛載已完成
│   ├── middlewares/auth.ts    ← JWT 驗證已完成
│   └── lib/
│       ├── errors.ts          ← AppError + errorHandler 已完成
│       ├── logger.ts          ← pino singleton 已完成
│       └── ai.ts              ← AI 函式骨架（待 Phase 2 實作）
```

---

## 如何啟動專案

```bash
# 安裝依賴
pnpm install

# 啟動 API server（port 5000）
pnpm --filter @workspace/api-server run dev

# 型別檢查（每次修改後必跑）
pnpm run typecheck

# 推送 DB schema
pnpm --filter @workspace/db run push

# 驗證 API server 正常
curl localhost:80/api/healthz
```

---

## 關鍵開發規範（必讀）

### 必須遵守

1. **Contract-First**：先看 `lib/api-spec/openapi.yaml`，不要自行新增未定義的端點
2. **型別安全**：禁止 `any`，所有 request body 用 Zod schema 驗證
3. **錯誤處理**：一律 `throw new AppError(message, ERROR_CODES.XXX, httpStatus)`，再 `next(err)`
4. **日誌**：route handler 用 `req.log.info()`，其他地方用 `import { logger } from "../lib/logger.js"`
5. **使用者隔離**：所有 DB query 必須帶 `where(eq(table.userId, req.user!.id))`
6. **AI 不阻塞**：AI 呼叫用 `void triggerXxx(...)` 背景執行，主流程立即回傳

### 禁止

- `console.log` / `console.error`（用 pino logger）
- 直接用 `req.params.id`（需 `String(req.params.id)`）
- 修改 `lib/api-zod/src/generated/` 內的檔案
- 在路由內直接 `res.status(400).send()`（走 `next(AppError)` 流程）

### Express 5 注意事項

```typescript
// ✅ Express 5 params 型別為 string | string[]，需強制轉型
const id = String(req.params.id);
const page = parseInt(String(req.query.page ?? "1"), 10);

// ✅ async 路由 Express 5 原生支援，不需 express-async-handler
router.get("/notes", requireAuth, async (req, res, next) => {
  try { ... } catch (err) { next(err); }
});
```

---

## 路由範本（複製後修改）

```typescript
import { Router } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";

const router = Router();

router.get("/resource", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const result = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.userId, userId))
      .orderBy(desc(notesTable.createdAt));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
```

---

## 資料庫操作

```typescript
// 向量欄位查詢（必須加 ::vector cast）
import { sql } from "drizzle-orm";
const vectorStr = `[${vector.join(",")}]`;
const results = await db.execute(
  sql`SELECT id, ai_title, ai_summary,
      embedding <=> ${vectorStr}::vector AS distance
      FROM notes
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY distance
      LIMIT ${topK}`
);

// upsert（標籤用）
await db.insert(tagsTable)
  .values({ userId, name: tag, useCount: 1 })
  .onConflictDoUpdate({
    target: [tagsTable.userId, tagsTable.name],
    set: { useCount: sql`${tagsTable.useCount} + 1` }
  });
```

---

## 環境變數

詳見 `.env.example`。開發時至少需要：
- `DATABASE_URL`（Replit PostgreSQL，已存在）
- `SUPABASE_JWT_SECRET`（從 Supabase Dashboard 取得）
- `GEMMA_API_KEY`（從 Google AI Studio 取得）

沒有 `SUPABASE_JWT_SECRET` 時，auth middleware 自動切換為 parse-only 模式（開發用，不驗簽章）。

---

## 設計系統

前端設計書：`06_前端設計書_v2.md`
設計主題：Circuit Memory
Logo 檔案：`MemoRy Logo.png`

核心設計 token：
```
背景：#090C14 / #0F1219 / #161A28
主色：#5B7AE0（Signal Blue）/ #8B7AE0（Circuit Purple）
完成：#34D4A8（✦ 磷光綠）/ 待處理：#F0A030 / 失敗：#F05068
文字：#DFE4F0 / #8A96B2 / #4A5272
```

---

## 驗收標準（每個任務完成前必須通過）

```bash
# 1. 型別無錯誤
pnpm run typecheck

# 2. API 手動驗證（範例）
curl -H "Authorization: Bearer <token>" localhost:80/api/notes
curl -X POST localhost:80/api/notes/text \
  -H "Content-Type: application/json" \
  -d '{"sourceText":"測試","sourceUrl":"https://example.com"}'

# 3. 錯誤情境測試
curl localhost:80/api/notes/non-existent-id  # 應回傳 404

# 4. 使用者隔離測試
# 用 user_A token 嘗試存取 user_B 的資源，應回傳 403/404
```

---

## 常用指令速查

```bash
pnpm run typecheck                              # 全專案型別檢查
pnpm run typecheck:libs                         # 僅 lib/*
pnpm --filter @workspace/db run push            # 推送 DB schema
pnpm --filter @workspace/api-spec run codegen   # 重新生成 Zod hooks
pnpm run build                                  # 生產環境 build
curl localhost:80/api/healthz                   # 健康檢查
```
