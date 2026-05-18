# MemoRy — Claude Code Phase 執行腳本

> 使用方式：每個 Phase 開頭將對應的「啟動 Prompt」貼給 Claude Code，
> 完成後執行「驗收指令」確認，再進行下一個 Phase。

---

## Phase 1：後端 API 路由實作

### 啟動 Prompt

```
請參考以下文件實作 MemoRy 的 Phase 1 後端 API 路由：
- CLAUDE.md（專案規範與現況）
- 03_資料庫結構與API契約.md（API 規格）
- 02_開發規範與約定.md（程式碼規範）

目前 Phase 0 已完成：DB Schema、OpenAPI 契約、Express 骨架、JWT auth middleware、錯誤處理。
請勿修改 lib/ 目錄下已有的檔案。

本次要實作（依優先順序）：

P0 任務：
1. GET  /api/notes         - 列表 + 分頁 + 過濾（tags、domain、dateFrom、dateTo）
2. POST /api/notes/text    - 建立文字筆記（立即回傳 201，AI 背景處理用 void）
3. POST /api/notes/image   - 建立圖片筆記（同上）
4. GET  /api/notes/:id     - 單一筆記（含 relatedNotes 佔位，先回傳空陣列）

P1 任務：
5. PATCH  /api/notes/:id   - 更新筆記
6. DELETE /api/notes/:id   - 刪除筆記（204 No Content）
7. GET    /api/tags         - 標籤列表（依 useCount 排序）
8. GET    /api/search/keyword - 全文關鍵字搜尋

P2 任務：
9. GET /api/export          - 匯出（json 或 markdown 格式）

規則：
- 所有路由必須用 requireAuth middleware
- 所有 DB query 必須帶 userId 條件（使用者隔離）
- AI 呼叫暫時用 void triggerAiProcessing() 佔位（Phase 2 實作）
- 完成每個端點後執行 pnpm run typecheck 確認無型別錯誤
```

### 驗收指令

```bash
# 健康檢查
curl localhost:80/api/healthz

# 建立文字筆記
curl -X POST localhost:80/api/notes/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <test_token>" \
  -d '{"sourceText":"Transformer 注意力機制","sourceUrl":"https://github.com/test"}'
# 預期：{"noteId":"uuid","aiStatus":"pending"}

# 列出筆記
curl -H "Authorization: Bearer <test_token>" \
  "localhost:80/api/notes?page=1&limit=5"
# 預期：{"notes":[...],"total":N,"page":1,"limit":5}

# 標籤列表
curl -H "Authorization: Bearer <test_token>" localhost:80/api/tags

# 刪除筆記（回傳 204）
curl -X DELETE -H "Authorization: Bearer <test_token>" \
  localhost:80/api/notes/<noteId>

# 型別檢查
pnpm run typecheck
```

---

## Phase 2：AI 整合（Gemma）

### 啟動 Prompt

```
請參考以下文件實作 MemoRy 的 Phase 2 AI 整合：
- 07_Gemma_AI整合規格.md（Gemma API 端點、Prompt 模板、實作範例）
- CLAUDE.md（AI 降級規範）

Phase 1 已完成所有 API 路由。本次要實作：

1. 完整實作 artifacts/api-server/src/lib/ai.ts 中的 5 個函式：
   - summarizeText(text)   → 摘要 + 標題 + 標籤
   - ocrImage(base64)      → 圖片 OCR
   - embedText(text, taskType) → 768 維向量
   - ragAnswer(query, contexts) → RAG 問答
   - generateDailyReport(notes) → 知識日報

2. 整合至路由：
   - POST /api/notes/text  → 實作 triggerAiProcessing()（背景執行）
   - POST /api/notes/image → 先 OCR 再 triggerAiProcessing()
   - POST /api/search      → embedText(query, RETRIEVAL_QUERY) + 時間加權向量搜尋 + ragAnswer
   - GET  /api/notes/:id   → relatedNotes 用向量相似度計算（SEMANTIC_SIMILARITY）
   - POST /api/reports/generate → generateDailyReport

3. 向量搜尋 SQL（時間加權，參考 07_ 文件）

規則：
- AI 失敗必須 catch，更新 aiStatus = "failed"，不影響主流程
- AI 函式使用 exponential backoff retry（最多 2 次）
- 所有函式失敗拋出 AppError(AI_ERROR)
```

### 驗收指令

```bash
# 建立筆記後等待 5 秒，確認 AI 處理完成
NOTE_ID=$(curl -s -X POST localhost:80/api/notes/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"sourceText":"Transformer 注意力機制是深度學習的核心...","sourceUrl":"https://test.com"}' \
  | jq -r '.noteId')

sleep 5

curl -H "Authorization: Bearer <token>" localhost:80/api/notes/$NOTE_ID
# 預期：aiStatus: "done"，aiTitle、aiSummary、tags 均有值

# RAG 搜尋
curl -X POST localhost:80/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query":"什麼是注意力機制","topK":3}'
# 預期：{"answer":"...","sources":[...]}

# AI 降級測試（使用無效 API Key）
GEMMA_API_KEY=invalid pnpm --filter @workspace/api-server run dev
# 建立筆記後應得到 aiStatus: "failed"，筆記仍存在
```

---

## Phase 3：Chrome Extension 核心

### 啟動 Prompt

```
請參考以下文件建立 MemoRy Chrome Extension：
- 08_ChromeExtension_MV3規格.md（完整規格）
- 06_前端設計書_v2.md（Circuit Memory 設計系統）
- .env.example（環境變數）

本次要建立：

1. 目錄結構（artifacts/chrome-ext/）
   - 依 08_ 文件的目錄結構建立所有骨架檔案

2. manifest.json（完全按 08_ 文件規格）

3. vite.config.ts（使用 vite-plugin-web-extension）

4. Auth 系統（src/shared/auth.ts）
   - Token 存 chrome.storage.local
   - loginWithGoogle()、loginWithEmail()、isLoggedIn()

5. Service Worker（src/background/service-worker.ts）
   - 訊息路由（SAVE_TEXT、GET_RECENT_NOTES、CHECK_AUTH 等）
   - 右鍵選單（儲存文字、截圖）

6. Popup UI（src/popup/）
   - PopupApp.tsx：判斷登入狀態，切換 LoginView / MainView
   - LoginView.tsx：Google 登入 + Email 登入
   - MainView.tsx：搜尋欄 + 最近筆記 + Action Bar

7. Content Script（src/content/）
   - 監聽 mouseup 事件，選取文字後顯示 CaptureBar
   - CaptureBar.tsx：儲存至 MemoRy 的浮動工具列

設計 Token：
  背景：#090C14 / #0F1219 / #161A28
  主色：#5B7AE0 / #8B7AE0
  完成：✦ #34D4A8 / 待處理：■ #F0A030 / 失敗：#F05068
  文字：#DFE4F0 / #8A96B2 / #4A5272
  
Logo：使用 MemoRy Logo.png，popup header 中 h=26px
```

### 驗收指令

```bash
# Build Extension
pnpm --filter @workspace/chrome-ext run build

# 確認 dist/ 結構
ls artifacts/chrome-ext/dist/

# 手動測試（Chrome → 擴充功能 → 載入未封裝項目 → 選 dist/）
# 1. Popup 顯示 MemoRy Logo
# 2. 點擊 Google 登入
# 3. 登入後顯示最近筆記
# 4. 在任意網頁選取文字 → 出現 CaptureBar
# 5. 點擊儲存 → API 收到 POST /api/notes/text
# 6. 右鍵 → 「儲存至 MemoRy」功能正常
```

---

## Phase 4：Web Dashboard MVP

### 啟動 Prompt

```
請參考以下文件建立 MemoRy Web Dashboard：
- 06_前端設計書_v2.md（完整 UI 規格、Circuit Memory 設計系統）
- 03_資料庫結構與API契約.md（API 契約）
- tailwind.config.ts（設計 Token）
- 品牌元件：PixelCluster.tsx、StarDone.tsx、TimelineConnector.tsx（已提供）

本次要建立（artifacts/web-dashboard/）：

1. 專案初始化：Vite + React + TypeScript + Tailwind CSS v4
   使用 pnpm --filter @workspace/api-zod run codegen 的 hooks

2. 路由設定（React Router v7）：
   / → /timeline
   /login、/timeline、/notes/:id、/search、/reports、/reports/:date、/settings

3. 共用 Layout（Sidebar + 主內容區）
   - Sidebar 使用設計書規格（188px，含 Logo、導覽、標籤過濾）
   - Logo 使用 MemoRy Logo.png h=32px

4. 頁面 MVP（依優先順序）：
   P0: LoginPage（Supabase Auth）
   P0: TimelinePage（筆記列表 + 時間軸連接線 + 無限滾動）
   P1: SearchPage（RAG 搜尋 + AI 回答面板 + 引用來源）
   P1: ReportsPage + ReportDetailPage
   P2: NotePage（詳情）
   P2: SettingsPage（匯出）

5. 品牌元件整合：
   - Done 筆記用 StarDone 元件（✦）
   - Pending 筆記用 PixelCluster 元件（像素碎片動畫）
   - 時間軸用 TimelineConnector 元件
   - Tag 雙色：藍 = 使用者標籤，紫 = AI 生成標籤

設計核心（必須遵守）：
- NoteCard padding: 16px，摘要預設顯示 2 行（line-height: 1.7）
- AI 回答 line-height: 1.8
- 所有背景用 Circuit Memory token，不用純黑
```

### 驗收指令

```bash
# 啟動 Dashboard
pnpm --filter @workspace/web-dashboard run dev

# 瀏覽器驗證
# 1. http://localhost:3000 → 重導向至 /login
# 2. 登入後顯示時間軸，筆記有摘要兩行可見
# 3. Done 筆記顯示 ✦，Pending 顯示 Pixel 碎片動畫
# 4. 搜尋頁 RAG 搜尋正常運作，有 AI 回答 + 引用來源
# 5. 日報頁面可以查看和生成日報

# 型別檢查
pnpm run typecheck
```

---

## Phase 5：進階功能

### 啟動 Prompt

```
Phase 1-4 已完成核心功能。本次實作進階功能：

1. aiStatus 即時更新（Polling → Supabase Realtime）
   - TimelinePage 的 Pending 卡片每 3 秒自動 refetch
   - 完成後動畫：PixelCluster 消失 → ✦ 出現（Framer Motion）

2. IVFFlat 向量索引（超過 1000 筆筆記後）
   CREATE INDEX notes_embedding_idx ON notes
   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

3. 日報自動排程（每日午夜）
   使用 Node.js setInterval 或 node-cron 在 api-server 啟動時設定

4. Extension Sidebar（相關筆記即時推薦）
   - 讀取頁面 URL → 向量搜尋相關筆記
   - 右側固定面板，可收合

5. 批次重試（aiStatus = "failed" 的筆記）
   - GET /api/notes?aiStatus=failed 列出失敗筆記
   - PATCH /api/notes/:id/retry 重新觸發 AI 處理
```

---

## Phase 6：品質與部署

### 啟動 Prompt

```
Phase 1-5 功能已完成。本次做最終品質確認與部署：

1. API Integration Tests（Supertest）
   - 每個端點的成功路徑
   - 錯誤路徑（缺欄位、無權限、資源不存在）
   - 使用者隔離（cross-user access 應回傳 403/404）

2. Chrome Extension 打包
   pnpm --filter @workspace/chrome-ext run build
   → 產出 dist.zip 供 Chrome Web Store 上傳

3. Web Dashboard 部署
   pnpm --filter @workspace/web-dashboard run build
   → Replit Publish

4. 安全審查
   - 確認所有 DB query 帶 userId
   - 確認 JWT 驗證在所有端點生效
   - 確認 express.json({ limit: "15mb" }) 防止超大 payload
   - 確認 Secrets 不在程式碼中

5. 效能測試
   - 搜尋端點 p95 < 200ms
   - 確認向量索引已建立（> 1000 筆時）
```

---

## 跨 Phase 通用規則（每次都要遵守）

```
開始每個任務前：
  □ 讀取 CLAUDE.md 確認目前進度
  □ pnpm run typecheck 確認目前狀態無錯誤

完成每個任務後：
  □ pnpm run typecheck（0 errors）
  □ 執行對應的驗收指令
  □ 確認錯誤情境已處理（缺欄位、無權限、資源不存在）
  □ 日誌使用 req.log / logger（無 console.log）
```
