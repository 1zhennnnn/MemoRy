# MemoRy — Claude Code 啟動 Prompt

---

## PHASE 1 啟動（後端 API）

```
你是 MemoRy 專案的開發者。MemoRy 是一套 AI 碎片化知識管理系統，
由 Chrome Extension（MV3）+ Web Dashboard（React）+ Express 5 API Server 組成的 pnpm Monorepo。

請先閱讀以下文件（依序，全部讀完再開始任何修改）：
1. CLAUDE.md                         ← 專案現況、規範、禁止事項（最重要）
2. 02_開發規範與約定.md              ← 程式碼風格、錯誤處理、日誌規範
3. 03_資料庫結構與API契約.md         ← API 規格（你的實作依據）
4. 04_基礎骨架.md                    ← 哪些檔案已存在、不可覆蓋

讀完後，開始實作 Phase 1：後端 API 路由。

━━━ 目前狀態 ━━━
Phase 0 已完成：
✅ DB Schema（notes、tags、daily_reports）+ pgvector
✅ OpenAPI 契約（17 端點）
✅ Express 5 app 骨架（app.ts、routes/index.ts）
✅ JWT auth middleware（jose）
✅ AppError + errorHandler + pino logger
✅ pnpm run typecheck 目前 0 errors

━━━ 本次任務（Phase 1）━━━

請依以下優先順序實作，每完成一個就執行 pnpm run typecheck：

【P0 — 核心筆記 CRUD】
1. GET  /api/notes
   - 支援 query: page(預設1)、limit(預設20,最大100)、sort、tags(逗號分隔)、domain、dateFrom、dateTo
   - 回傳: { notes: NoteCard[], total, page, limit }
   - 必須帶 userId 條件（使用者隔離）

2. POST /api/notes/text
   - body: { sourceUrl?, sourceTitle?, sourceText, userNote? }
   - sourceText 必填，缺少時拋出 AppError(MISSING_FIELD, 400)
   - 立即建立 note（aiStatus="pending"），回傳 201 { noteId, aiStatus: "pending" }
   - 呼叫 void triggerAiProcessing(noteId, sourceText)（暫時是空函式，Phase 2 實作）

3. POST /api/notes/image
   - body: { sourceUrl?, sourceTitle?, imageBase64, userNote? }
   - imageBase64 必填
   - 同上，回傳 201 { noteId, aiStatus: "pending" }

4. GET /api/notes/:id
   - 回傳完整筆記 + relatedNotes: []（先回傳空陣列，Phase 2 實作向量搜尋）
   - 不存在或不屬於此 user → 404

【P1 — 更新、刪除、標籤】
5. PATCH /api/notes/:id
   - body: { aiTitle?, aiSummary?, userNote?, tags? }（全部選填）
   - 回傳 { noteId, reembedding: false }（Phase 2 再實作 re-embedding）

6. DELETE /api/notes/:id
   - 成功回傳 204 No Content
   - 不存在或不屬於此 user → 404

7. GET /api/tags
   - 回傳 { tags: [{ name, useCount }] }（依 useCount DESC 排序）

【P2 — 搜尋、匯出】
8. GET /api/search/keyword
   - query: q（必填）、page、limit
   - 用 ILIKE 在 ai_title、ai_summary、source_text、user_note 搜尋
   - 回傳格式同 GET /api/notes

9. GET /api/export
   - query: format（"json" 或 "markdown"，預設 "json"）
   - json: 回傳 { exportedAt, totalNotes, notes: [...] }
   - markdown: Content-Type: text/markdown，每筆筆記一個區塊

━━━ 必須遵守的規則 ━━━

✅ 每個路由都要 requireAuth middleware
✅ 所有 DB query 必須帶 where(eq(table.userId, req.user!.id))
✅ req.params 轉型：const id = String(req.params.id)
✅ req.query 轉型：const page = parseInt(String(req.query.page ?? "1"), 10)
✅ 錯誤統一：throw new AppError(msg, ERROR_CODES.XXX, status)，再 next(err)
✅ 禁止 console.log，用 req.log.info() 或 req.log.error()
✅ 完成每個端點後執行 pnpm run typecheck

❌ 不要修改 lib/ 目錄下的任何檔案
❌ 不要修改 app.ts、routes/index.ts 的路由掛載結構
❌ 不要自行新增 openapi.yaml 中未定義的端點

━━━ 驗收標準（全部完成後執行）━━━

curl localhost:80/api/healthz
# 預期：{"status":"ok"}

curl -X POST localhost:80/api/notes/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"sourceText":"Transformer 注意力機制","sourceUrl":"https://github.com"}'
# 預期：{"noteId":"uuid","aiStatus":"pending"}

curl -H "Authorization: Bearer <token>" "localhost:80/api/notes?page=1&limit=5"
# 預期：{"notes":[...],"total":N,"page":1,"limit":5}

curl -X DELETE -H "Authorization: Bearer <token>" localhost:80/api/notes/<id>
# 預期：HTTP 204

pnpm run typecheck
# 預期：0 errors

━━━ 開始 ━━━
請從讀取 CLAUDE.md 開始，確認現況後開始實作 GET /api/notes。
```

---

## PHASE 2 啟動（AI 整合）

> Phase 1 完成後使用

```
Phase 1 已完成，所有 API 路由通過 curl 驗證與 typecheck。

請閱讀：
- 07_Gemma_AI整合規格.md（完整的 Gemma API 端點、Prompt 模板、實作範例）
- CLAUDE.md（AI 降級規範）

本次實作 Phase 2：AI 整合。

在 artifacts/api-server/src/lib/ai.ts 實作以下函式：

1. summarizeText(text: string)
   → 呼叫 Gemma generateContent API
   → 回傳 { title, summary, tags }
   → Prompt 模板在 07_ 文件

2. ocrImage(imageBase64: string)
   → 呼叫 Gemma generateContent API（含 inline_data 圖片）
   → 回傳 string（提取的文字）

3. embedText(text: string, taskType)
   → 呼叫 Gemma embedContent API
   → 回傳 number[]（768 維向量）

4. ragAnswer(query: string, contexts: RagContext[])
   → 呼叫 Gemma generateContent API
   → 回傳 string（彙整回答）

5. generateDailyReport(notes: ReportNote[])
   → 呼叫 Gemma generateContent API
   → 回傳 { keyLearnings, crossDomain, suggestions }

整合至路由：
- POST /api/notes/text  → 實作 triggerAiProcessing()
- POST /api/notes/image → 先 ocrImage() 再 triggerAiProcessing()
- POST /api/search      → embedText() + 時間加權向量搜尋 SQL + ragAnswer()
- GET  /api/notes/:id   → relatedNotes 用 embedText(SEMANTIC_SIMILARITY) 搜尋
- POST /api/reports/generate → generateDailyReport()

關鍵規則：
✅ AI 失敗必須 catch → aiStatus = "failed"，不影響主流程
✅ void triggerAiProcessing()（背景執行，不 await）
✅ 向量欄位查詢必須加 ::vector cast
✅ 時間加權搜尋 SQL 在 07_ 文件第 5 節

驗收：
建立筆記後等 5 秒，GET /api/notes/:id 應有 aiStatus: "done"、aiTitle、aiSummary
POST /api/search 應有 answer 和 sources
GEMMA_API_KEY 設錯時，筆記仍建立，aiStatus: "failed"
```

---

## PHASE 3 啟動（Chrome Extension）

> Phase 1-2 完成後使用

```
Phase 1-2 已完成。請閱讀：
- 08_ChromeExtension_MV3規格.md（完整規格）
- 06_前端設計書_v2.md（Circuit Memory 設計系統）
- .env.example（VITE_ 開頭的前端變數）

本次建立 artifacts/chrome-ext/：

1. 初始化專案
   - package.json（參考 08_ 文件第 11 節）
   - manifest.json（完全按 08_ 文件第 3 節）
   - vite.config.ts（08_ 文件第 4 節）
   - tsconfig.json

2. 共用模組（src/shared/）
   - auth.ts（token 存 chrome.storage.local）
   - api.ts（apiGet、apiPost fetch wrapper）
   - constants.ts（API_BASE_URL 等）

3. Service Worker（src/background/service-worker.ts）
   - 訊息路由（SAVE_TEXT、SAVE_SCREENSHOT、GET_RECENT_NOTES、CHECK_AUTH、LOGIN_*、LOGOUT）
   - 右鍵選單（儲存文字、截圖）
   - Supabase OAuth（chrome.identity.launchWebAuthFlow）

4. Popup UI（src/popup/）
   - PopupApp.tsx → 判斷登入狀態
   - LoginView.tsx → Google + Email 登入
   - MainView.tsx → SearchBar + RecentNotes + ActionBar
   - 使用 PixelCluster.tsx、StarDone.tsx（已提供）

5. Content Script（src/content/）
   - 監聽 mouseup → 選取文字 → 顯示 CaptureBar
   - CaptureBar.tsx（浮動工具列）

設計規則：
背景：#090C14（Popup）/ #0F1219（主背景）
主色：#5B7AE0 / #8B7AE0
完成：✦ StarDone（#34D4A8）
待處理：PixelCluster（#5B7AE0）+ 掃描動畫
文字：#DFE4F0 / #8A96B2 / #4A5272
卡片 padding: 16px，摘要顯示 1 行（Popup 空間有限）

驗收：
pnpm --filter @workspace/chrome-ext run build
在 Chrome 載入 dist/，Popup 正常顯示 Logo
選取網頁文字 → CaptureBar 出現 → 儲存 → API 收到 POST /api/notes/text
```

---

## PHASE 4 啟動（Web Dashboard）

> Phase 1-2 完成後（可與 Phase 3 並行）

```
請閱讀：
- 06_前端設計書_v2.md（完整 UI 規格）
- tailwind.config.ts（設計 Token，已提供）
- globals.css（CSS 變數，已提供）
- PixelCluster.tsx、StarDone.tsx、TimelineConnector.tsx（品牌元件，已提供）

本次建立 artifacts/web-dashboard/（Vite + React + TypeScript + Tailwind CSS v4）：

1. 專案初始化
   - vite.config.ts（port 3000）
   - tailwind.config.ts 複製到此目錄
   - globals.css 複製到 src/globals.css

2. 路由（React Router v7）
   / → /timeline
   /login /timeline /notes/:id /search /reports /reports/:date /settings

3. 共用 Layout
   - Sidebar（188px，Logo h=32px，導覽，標籤過濾）
   - 使用 MemoRy Logo.png

4. 頁面（依優先順序）
   P0: LoginPage（Supabase Auth）
   P0: TimelinePage
       - 筆記列表 + TimelineConnector 連接線
       - 日期群組（今天 / 昨天 / {日期}）
       - NoteCard：padding 16px，摘要預設 2 行，line-height 1.7
       - Done → StarDone ✦；Pending → PixelCluster + 掃描動畫
   P1: SearchPage
       - RAG / 關鍵字 toggle
       - AI 回答面板（Circuit Purple 左側條，line-height 1.8）
       - 引用來源卡片（含摘要節錄）
   P1: ReportsPage + ReportDetailPage
       - 學習要點：✦ + text（line-height 1.7）
       - 各區塊：Circuit Purple 左側條
   P2: NotePage、SettingsPage

Tag 雙色規則：
  藍色（#7B96F0）= 使用者輸入的標籤
  紫色（#A898F0）= AI 自動生成的標籤

驗收：
pnpm --filter @workspace/web-dashboard run dev
http://localhost:3000 → 登入 → 時間軸顯示筆記 → Done 卡片有 ✦ → Pending 有 Pixel 動畫
搜尋有 AI 回答 + 引用來源摘要
pnpm run typecheck = 0 errors
```

---

## 通用規則（每次 Claude Code 對話開頭提醒）

```
開始前請確認：
1. 讀取 CLAUDE.md（目前進度 + 規範）
2. pnpm run typecheck（確認目前 0 errors）
3. 不修改 lib/ 目錄下的已有檔案

完成後必須：
1. pnpm run typecheck = 0 errors
2. 對應的 curl 驗收指令全部通過
3. 錯誤情境已處理（缺欄位 400、無權限 403、不存在 404）
4. 無 console.log（改用 req.log 或 logger）
```
