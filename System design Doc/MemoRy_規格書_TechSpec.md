# MemoRy 系統規格書（Technical Specification）

- **文件版本**：v1.0
- **專案名稱**：MemoRy — AI 碎片化知識管理系統
- **撰寫日期**：2026-05-15
- **組別**：第四組（陳薏安、陳亭妤、黃翊禎）

---

## 目錄

1. [系統架構總覽](#1-系統架構總覽)
2. [Chrome Extension 規格](#2-chrome-extension-規格)
3. [後端 API 服務規格](#3-後端-api-服務規格)
4. [AI Pipeline 規格](#4-ai-pipeline-規格)
5. [資料庫規格](#5-資料庫規格)
6. [向量搜尋規格](#6-向量搜尋規格)
7. [網頁儀表板規格](#7-網頁儀表板規格)
8. [API 端點規格](#8-api-端點規格)
9. [資料流程圖](#9-資料流程圖)
10. [部署架構](#10-部署架構)
11. [錯誤處理規格](#11-錯誤處理規格)

---

## 1. 系統架構總覽

### 1.1 高層架構圖

```
┌─────────────────────────────────────────────────────────┐
│                   使用者裝置（Browser）                   │
│                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐   │
│  │  Chrome Extension    │   │  Web Dashboard       │   │
│  │  (MV3)              │   │  (React + Vite)      │   │
│  │                      │   │                      │   │
│  │  ・Background SW     │   │  ・筆記列表           │   │
│  │  ・Content Script    │   │  ・語意搜尋           │   │
│  │  ・Side Panel        │   │  ・日報回顧           │   │
│  │  ・Offscreen Doc     │   │  ・主題聚合           │   │
│  └──────────┬───────────┘   └──────────┬───────────┘   │
└─────────────┼──────────────────────────┼───────────────┘
              │  HTTPS / JWT              │  HTTPS / JWT
              ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                後端 API 服務（Vercel / Node.js）          │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  擷取路由     │  │  AI 處理路由  │  │  搜尋路由    │  │
│  │  /capture    │  │  /ai/*       │  │  /search     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Supabase        │  │  Gemma API   │  │  EmbeddingGemma  │
│  PostgreSQL      │  │  (Gemma 4    │  │  (768 維向量)    │
│  + pgvector      │  │   E4B)       │  │                  │
│  + Auth (RLS)    │  │              │  │                  │
└──────────────────┘  └──────────────┘  └──────────────────┘
```

### 1.2 技術堆疊總表

| 層次 | 技術選擇 | 說明 |
|------|---------|------|
| 前端擴充功能 | Chrome Extension MV3、TypeScript、React | 側欄介面以 React 開發 |
| 網頁儀表板 | React + Vite、TypeScript、TailwindCSS | 靜態部署 |
| 後端 API | Node.js + Express（或 Vercel Functions） | REST API |
| 資料庫 | Supabase PostgreSQL + pgvector | 向量與關聯資料統一存放 |
| 身份驗證 | Supabase Auth（OAuth）+ JWT | RLS 行級安全 |
| 文字生成 LLM | Gemma 4 E4B | 摘要、標籤、RAG 回答 |
| 多模態 LLM | Gemma 4 E4B（Vision） | 截圖 OCR |
| 嵌入模型 | EmbeddingGemma | 768 維語意向量 |
| 向量搜尋 | pgvector（ivfflat 索引） | 餘弦相似度 |
| 部署 | Vercel Hobby（免費） | 靜態網站 + Serverless Functions |

---

## 2. Chrome Extension 規格

### 2.1 Manifest V3 元件清單

```json
{
  "manifest_version": 3,
  "name": "MemoRy",
  "version": "1.0.0",
  "permissions": [
    "contextMenus",
    "storage",
    "identity",
    "offscreen",
    "sidePanel",
    "alarms"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

### 2.2 元件說明

#### Background Service Worker（background.js）

| 職責 | 實作方式 |
|------|---------|
| 右鍵選單管理 | `chrome.contextMenus.create()` 建立「儲存至 MemoRy」選單 |
| 右鍵事件處理 | `chrome.contextMenus.onClicked` 接收選取文字，轉發至 API |
| OAuth 流程 | `chrome.identity.launchWebAuthFlow()` 執行 Supabase OAuth |
| Token 管理 | `chrome.storage.local.set/get()` 加密存取 JWT |
| 保持活躍 | `chrome.alarms.create()` 每 25 秒自喚醒，避免 30 秒休眠 |
| 訊息路由 | `chrome.runtime.onMessage` 接收 Content Script / Side Panel 訊息 |

#### Content Script（content.js）

| 職責 | 實作方式 |
|------|---------|
| 取得目前頁面資訊 | `document.title`、`window.location.href` |
| 監聽來自 Background 的指令 | `chrome.runtime.onMessage.addListener()` |
| 回傳當前頁面 metadata | 回傳至 Background，隨筆記一起送出 |

#### Offscreen Document（offscreen.html / offscreen.js）

| 職責 | 實作方式 |
|------|---------|
| 圖片 Blob 取得 | `fetch()` 取得截圖 URL 的 Blob |
| Base64 轉換 | `FileReader.readAsDataURL()` |
| 跨域圖片處理 | 繞過 CORS 限制，在 Offscreen 環境執行 |

#### Side Panel（sidepanel.html + React）

| 職責 | UI 元素 |
|------|---------|
| 顯示最新擷取狀態 | 狀態卡片（處理中 / 完成 / 失敗） |
| 圖片貼入上傳區 | 拖拉區 + Ctrl+V 監聽 |
| 顯示 AI 摘要結果 | 標題、摘要、標籤 chip |
| 心得輸入 | Textarea + 儲存按鈕 |
| 語意搜尋入口 | 搜尋欄（快速查詢） |
| 相關筆記推薦 | 依當前頁面 URL 推薦 3 筆相關筆記 |

### 2.3 Extension 內部訊息格式

```typescript
// Content Script → Background
interface PageInfoMessage {
  type: 'GET_PAGE_INFO';
}

// Background → Side Panel（文字擷取完成）
interface CaptureCompleteMessage {
  type: 'CAPTURE_COMPLETE';
  noteId: string;
  title: string;
  summary: string;
  tags: string[];
}

// Side Panel → Background（觸發圖片處理）
interface ImageCaptureMessage {
  type: 'IMAGE_CAPTURE';
  base64: string;
  mimeType: string;
}
```

---

## 3. 後端 API 服務規格

### 3.1 服務定位

後端採用 Vercel Serverless Functions（Node.js 18+），每個 API 路由對應一個 Function。無需常駐伺服器，符合免費方案限制。

### 3.2 中介層（Middleware）

| 中介層 | 說明 |
|--------|------|
| JWT 驗證 | 每個請求驗證 Supabase JWT，提取 `user_id` |
| CORS | 允許 Extension origin 與 Dashboard origin |
| 請求大小限制 | body 最大 15 MB（圖片 Base64 需求） |
| 速率限制 | 每個 user_id 每分鐘最多 30 次 AI 請求 |
| 錯誤統一格式 | 所有錯誤回傳 `{ error: string, code: string }` |

### 3.3 身份驗證流程

```
Chrome Extension:
  1. chrome.identity.launchWebAuthFlow(supabaseOAuthUrl)
  2. 取得 access_token（JWT）
  3. 存入 chrome.storage.local（加密）
  4. 每次 API 請求 Header: Authorization: Bearer <token>

Web Dashboard:
  1. Supabase JS SDK 直接處理 OAuth redirect
  2. Session 存於 localStorage（Supabase SDK 管理）
```

---

## 4. AI Pipeline 規格

### 4.1 文字摘要 Pipeline

```
輸入：{ text: string, sourceUrl: string, pageTitle: string }
        ↓
Gemma 4 E4B (text-only mode)
  System Prompt: 你是一個知識管理助手，請分析以下文字並以 JSON 格式回傳。
  溫度：temperature = 0.3
  輸出格式：json_schema structured output
        ↓
輸出 JSON：
{
  "title": "15字以內的標題",
  "summary": "3～5句精簡摘要",
  "tags": ["標籤1", "標籤2"]  // 2～3個，優先使用已存在標籤
}
        ↓
EmbeddingGemma
  輸入：title + " " + summary + " " + tags.join(" ")
  輸出：float64[768]（語意向量）
        ↓
寫入 PostgreSQL（notes 表 + 向量欄位）
```

**Prompt 模板（文字摘要）**

```
你是一個知識管理助手。請分析以下網頁文字，並以 JSON 格式回傳結果。

已存在的標籤（優先使用）：{existing_tags}

請回傳：
- title：15 字以內的精簡標題（繁體中文）
- summary：3～5 句摘要，保留核心概念（繁體中文）
- tags：2～3 個語意標籤，盡量從已存在標籤中選擇

來源網址：{source_url}
頁面標題：{page_title}

文字內容：
{text}

請以 JSON 格式回傳，不要加任何額外說明。
```

### 4.2 截圖 OCR Pipeline

```
輸入：{ base64Image: string, mimeType: "image/png" | "image/jpeg" }
        ↓
Gemma 4 E4B (multimodal / vision mode)
  System Prompt: 你是一個 OCR 與知識管理助手。
  max_tokens = 1000
  圖片以 Base64 傳入（Content: [{ type: "image_url", ... }]）
        ↓
輸出 JSON：
{
  "recognized_text": "辨識到的完整文字",
  "title": "15字以內的標題",
  "summary": "3～5句精簡摘要",
  "tags": ["標籤1", "標籤2"],
  "confidence": "high" | "medium" | "low"
}
        ↓
confidence = "low" → 前端顯示「辨識結果可能不完整」警告
        ↓
EmbeddingGemma → 向量化 → 寫入資料庫
```

**Prompt 模板（截圖 OCR）**

```
你是一個 OCR 與知識管理助手。請辨識圖片中的所有文字，並整理成筆記。

請回傳 JSON 格式：
- recognized_text：圖片中辨識到的完整文字（保留原始格式）
- title：15 字以內的標題（繁體中文）
- summary：3～5 句摘要（繁體中文）
- tags：2～3 個語意標籤
- confidence：辨識信心度 "high" | "medium" | "low"

若圖片模糊或文字難以辨識，confidence 設為 "low"。
請以 JSON 格式回傳，不要加任何額外說明。
```

### 4.3 RAG 查詢 Pipeline

```
輸入：{ query: string, userId: string, topK: number = 5 }
        ↓
EmbeddingGemma
  輸入：query
  輸出：float64[768]（查詢向量）
        ↓
pgvector 向量搜尋
  SELECT *, (embedding <=> query_vector) * time_weight AS score
  ORDER BY score ASC LIMIT topK
  時間加權：time_weight = 1 / (1 + days_since_created * 0.01)
        ↓
取 top-K 筆記的 summary 作為 Context
        ↓
Gemma 4 E4B（RAG 回答生成）
  System Prompt: 你是一個知識助手，根據以下筆記摘要回答問題。
  Context: {top_k_summaries}
  問題: {query}
  temperature = 0.5
        ↓
輸出：
{
  "answer": "自然語言彙整回答",
  "source_note_ids": ["uuid1", "uuid2", ...]
}
```

**Prompt 模板（RAG）**

```
你是一個個人知識助手。以下是使用者的個人筆記摘要，請根據這些筆記回答使用者的問題。

相關筆記摘要：
{context}

使用者問題：{query}

請以自然語言回答，回答要具體且有幫助。若筆記中資訊不足，請誠實說明。
回答語言：繁體中文
```

### 4.4 日報生成 Pipeline

```
觸發：每日 00:00（cron job via Vercel Cron）或使用者手動觸發
輸入：userId，過去 24 小時的所有筆記 summary + tags
        ↓
Gemma 4 E4B（日報生成）
  生成三個區塊：
  1. 今日學習要點（bullet points）
  2. 跨域聯想分析（找出不同主題間的關聯）
  3. 明日探索建議（推薦延伸閱讀方向）
        ↓
寫入 daily_reports 表
```

---

## 5. 資料庫規格

### 5.1 資料表設計

#### users（由 Supabase Auth 管理）

```sql
-- Supabase auth.users 表（系統自動管理，無需手動建立）
-- 欄位：id (uuid), email, created_at, ...
```

#### notes（核心筆記表）

```sql
CREATE TABLE notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 原始內容
  source_text  TEXT,                    -- 使用者選取的原文（可為空，圖片筆記）
  source_url   TEXT,                    -- 來源網址
  source_title TEXT,                    -- 來源頁面標題
  image_path   TEXT,                    -- 截圖儲存路徑（Supabase Storage）
  
  -- AI 生成內容
  ai_title     TEXT NOT NULL,           -- AI 生成標題
  ai_summary   TEXT NOT NULL,           -- AI 生成摘要
  ocr_text     TEXT,                    -- OCR 辨識文字（截圖筆記專用）
  
  -- 使用者補充
  user_note    TEXT,                    -- 使用者個人心得
  
  -- 分類
  tags         TEXT[] DEFAULT '{}',     -- 語意標籤陣列
  
  -- 向量
  embedding    vector(768),             -- EmbeddingGemma 768 維向量
  
  -- 狀態
  ai_status    TEXT DEFAULT 'pending'   -- pending | processing | done | failed
                CHECK (ai_status IN ('pending', 'processing', 'done', 'failed')),
  
  -- 時間戳
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX notes_user_id_idx ON notes(user_id);
CREATE INDEX notes_created_at_idx ON notes(created_at DESC);
CREATE INDEX notes_tags_idx ON notes USING GIN(tags);
CREATE INDEX notes_embedding_idx ON notes 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 全文搜尋索引
CREATE INDEX notes_fts_idx ON notes 
  USING GIN(to_tsvector('chinese_simple', ai_title || ' ' || ai_summary));

-- Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can only access own notes"
  ON notes FOR ALL
  USING (auth.uid() = user_id);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### tags（標籤管理表）

```sql
CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  count      INT DEFAULT 1,           -- 使用此標籤的筆記數量
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can only access own tags"
  ON tags FOR ALL
  USING (auth.uid() = user_id);
```

#### daily_reports（日報表）

```sql
CREATE TABLE daily_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date     DATE NOT NULL,
  
  -- AI 生成區塊
  key_learnings   TEXT NOT NULL,       -- 今日學習要點
  cross_domain    TEXT,                -- 跨域聯想分析
  suggestions     TEXT,                -- 明日探索建議
  
  -- 使用者補充
  diary_text      TEXT,                -- 開放式日記
  
  -- 統計
  note_count      INT DEFAULT 0,       -- 當日筆記數量
  note_ids        UUID[] DEFAULT '{}', -- 關聯筆記 ID 清單
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, report_date)
);

ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can only access own reports"
  ON daily_reports FOR ALL
  USING (auth.uid() = user_id);
```

#### search_history（搜尋記錄，可選）

```sql
CREATE TABLE search_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can only access own search history"
  ON search_history FOR ALL
  USING (auth.uid() = user_id);
```

### 5.2 Supabase Storage 規格

| Bucket | 用途 | 存取控制 |
|--------|------|---------|
| `note-images` | 截圖圖片存放 | 私有，RLS 控制 |

```
路徑規則：note-images/{user_id}/{note_id}.{ext}
大小限制：10 MB / 檔案
允許格式：image/png, image/jpeg, image/webp
```

---

## 6. 向量搜尋規格

### 6.1 向量模型規格

| 項目 | 規格 |
|------|------|
| 模型 | EmbeddingGemma |
| 向量維度 | 768 |
| 距離函數 | 餘弦相似度（Cosine Similarity） |
| pgvector 運算符 | `<=>` （cosine distance） |
| 索引類型 | ivfflat（lists = 100） |

### 6.2 時間加權搜尋 SQL

```sql
-- 語意搜尋（時間加權）
SELECT
  id,
  ai_title,
  ai_summary,
  tags,
  source_url,
  created_at,
  -- 餘弦距離 × 時間加權因子
  (embedding <=> $1::vector) * (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - created_at)) / 86400 * 0.01)) AS score
FROM notes
WHERE user_id = $2
ORDER BY score ASC
LIMIT $3;

-- $1: 查詢向量（768 維）
-- $2: user_id
-- $3: topK（預設 5）
```

### 6.3 Embedding 觸發時機

| 事件 | 行為 |
|------|------|
| 筆記首次儲存（文字） | 異步觸發 Embedding，ai_status = 'processing' |
| 筆記首次儲存（OCR） | 同上 |
| 使用者手動編輯筆記內容 | 重新觸發 Embedding，更新向量 |
| Embedding 完成 | ai_status = 'done'，前端自動刷新 |
| Embedding 失敗 | ai_status = 'failed'，保留舊向量（若有） |

---

## 7. 網頁儀表板規格

### 7.1 頁面路由

| 路由 | 頁面名稱 | 功能摘要 |
|------|---------|---------|
| `/` | 首頁 / 登入 | OAuth 登入入口，未登入自動導向 |
| `/dashboard` | 儀表板 | 最新筆記概覽 + 搜尋入口 |
| `/notes` | 筆記列表 | 所有筆記，支援篩選、排序 |
| `/notes/:id` | 筆記詳細 | 單筆筆記全文、編輯、相關推薦 |
| `/search` | 搜尋結果 | RAG 查詢結果 + 相關筆記卡片 |
| `/reports` | 日報列表 | 時間軸呈現所有日報 |
| `/reports/:date` | 日報詳細 | 單日日報內容 + 日記編輯 |
| `/tags/:tag` | 標籤頁 | 篩選特定標籤的所有筆記 |
| `/settings` | 設定頁 | 匯出資料、帳號管理 |

### 7.2 核心元件規格

#### 筆記卡片（NoteCard）

```
顯示欄位：
  - AI 標題（ai_title）
  - 摘要前 100 字（ai_summary）
  - 標籤 chips（tags）
  - 來源網域（source_url → domain only）
  - 建立時間（created_at，相對時間）
  - AI 狀態指示器（pending / done / failed）
互動：
  - 點擊 → 進入筆記詳細頁
  - 標籤點擊 → 篩選同標籤筆記
```

#### 語意搜尋欄（SemanticSearch）

```
行為：
  - 輸入框支援 Enter 觸發搜尋
  - 搜尋中顯示 loading 動畫
  - 結果頁顯示：AI 回答區塊（Markdown 渲染）+ 來源筆記卡片列表
  - 搜尋記錄保留（最近 10 筆）
```

#### 日報頁面（DailyReport）

```
區塊：
  1. 今日學習要點（Markdown 列表）
  2. 跨域聯想分析（段落）
  3. 明日探索建議（Markdown 列表）
  4. 今日筆記一覽（筆記縮圖清單）
  5. 開放式日記（可編輯 Textarea，自動儲存）
```

### 7.3 前端狀態管理

```
推薦使用：React Query（TanStack Query）
  - 筆記列表：useQuery(['notes', filters])
  - 筆記詳細：useQuery(['note', noteId])
  - 語意搜尋：useMutation → 回傳後寫入快取
  - 日報：useQuery(['report', date])

實時更新：
  - 筆記 ai_status 變化：Supabase Realtime 訂閱
  - 訂閱條件：WHERE user_id = current_user_id
```

---

## 8. API 端點規格

### 8.1 筆記相關

#### `POST /api/notes/text` — 文字擷取建立筆記

```
Request Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Request Body:
{
  "sourceText": "string（必填）",
  "sourceUrl": "string（必填）",
  "pageTitle": "string（必填）",
  "userNote": "string（可選）"
}

Response 201:
{
  "noteId": "uuid",
  "aiTitle": "string",
  "aiSummary": "string",
  "tags": ["string"],
  "status": "processing"
}

Response 400: { "error": "sourceText is required", "code": "MISSING_FIELD" }
Response 401: { "error": "Unauthorized", "code": "UNAUTHORIZED" }
Response 429: { "error": "Rate limit exceeded", "code": "RATE_LIMIT" }
```

#### `POST /api/notes/image` — 截圖 OCR 建立筆記

```
Request Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Request Body:
{
  "base64Image": "string（必填，max 10MB 的 base64）",
  "mimeType": "image/png" | "image/jpeg"（必填）,
  "userNote": "string（可選）",
  "sourceUrl": "string（可選）"
}

Response 201:
{
  "noteId": "uuid",
  "recognizedText": "string",
  "aiTitle": "string",
  "aiSummary": "string",
  "tags": ["string"],
  "confidence": "high" | "medium" | "low",
  "status": "processing"
}

Response 413: { "error": "Image too large (max 10MB)", "code": "FILE_TOO_LARGE" }
```

#### `GET /api/notes` — 取得筆記列表

```
Query Parameters:
  page: number（預設 1）
  limit: number（預設 20，max 100）
  tags: string（逗號分隔）
  domain: string（來源網域篩選）
  dateFrom: ISO8601（開始日期）
  dateTo: ISO8601（結束日期）
  sort: "created_at_desc" | "created_at_asc"（預設 desc）

Response 200:
{
  "notes": [NoteCard],
  "total": number,
  "page": number,
  "totalPages": number
}
```

#### `GET /api/notes/:id` — 取得單筆筆記

```
Response 200:
{
  "id": "uuid",
  "sourceText": "string",
  "sourceUrl": "string",
  "sourceTitle": "string",
  "aiTitle": "string",
  "aiSummary": "string",
  "ocrText": "string | null",
  "userNote": "string | null",
  "tags": ["string"],
  "aiStatus": "done" | "failed",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "relatedNotes": [NoteCard]  // top-3 語意相關筆記
}
```

#### `PATCH /api/notes/:id` — 更新筆記

```
Request Body（所有欄位可選）:
{
  "aiTitle": "string",
  "aiSummary": "string",
  "userNote": "string",
  "tags": ["string"]
}

Response 200: { "noteId": "uuid", "reembedding": true }
// 若修改 aiTitle 或 aiSummary，後端自動觸發重新 Embedding
```

#### `DELETE /api/notes/:id` — 刪除筆記

```
Response 204: （no content）
// 同步刪除 pgvector 向量記錄與 Supabase Storage 圖片
```

### 8.2 搜尋相關

#### `POST /api/search` — 語意搜尋（RAG）

```
Request Body:
{
  "query": "string（必填）",
  "topK": number（可選，預設 5，max 10）
}

Response 200:
{
  "answer": "string（AI 彙整回答）",
  "sourceNotes": [NoteCard],
  "queryVector": null  // 不回傳原始向量
}

Response 400: { "error": "query is required", "code": "MISSING_FIELD" }
```

#### `GET /api/search/keyword` — 關鍵字搜尋

```
Query Parameters:
  q: string（必填）
  page: number（預設 1）
  limit: number（預設 20）

Response 200:
{
  "notes": [NoteCard],
  "total": number
}
```

### 8.3 日報相關

#### `GET /api/reports` — 取得日報列表

```
Query Parameters:
  page: number, limit: number

Response 200:
{
  "reports": [{
    "id": "uuid",
    "reportDate": "YYYY-MM-DD",
    "noteCount": number,
    "keyLearningPreview": "前50字"
  }],
  "total": number
}
```

#### `GET /api/reports/:date` — 取得特定日期日報

```
Path: date = "YYYY-MM-DD"

Response 200:
{
  "id": "uuid",
  "reportDate": "YYYY-MM-DD",
  "keyLearnings": "string（Markdown）",
  "crossDomain": "string（Markdown）",
  "suggestions": "string（Markdown）",
  "diaryText": "string | null",
  "noteCount": number,
  "notes": [NoteCard]
}

Response 404: { "error": "Report not found", "code": "NOT_FOUND" }
```

#### `PATCH /api/reports/:date/diary` — 更新日記內容

```
Request Body:
{ "diaryText": "string" }

Response 200: { "success": true }
```

#### `POST /api/reports/generate` — 手動觸發日報生成

```
Request Body:
{ "date": "YYYY-MM-DD（預設今日）" }

Response 202:
{ "message": "Report generation started", "reportId": "uuid" }
```

### 8.4 標籤相關

#### `GET /api/tags` — 取得使用者所有標籤

```
Response 200:
{
  "tags": [{
    "id": "uuid",
    "name": "string",
    "count": number
  }]
}
```

### 8.5 設定相關

#### `GET /api/export` — 匯出所有筆記

```
Query Parameters:
  format: "json" | "markdown"（預設 json）

Response 200:
  Content-Type: application/json 或 text/markdown
  Content-Disposition: attachment; filename="memory-export-{date}.{ext}"
```

---

## 9. 資料流程圖

### 9.1 文字擷取完整流程

```
使用者反白選取文字
       │
       ▼
Content Script 捕捉選取文字
       │
       ▼
Background SW 接收 + 取得頁面 metadata（URL、title）
       │
       ▼
呼叫 POST /api/notes/text（附 JWT）
       │
       ▼
後端驗證 JWT（Supabase Auth）
       │
       ▼
非同步啟動 AI Pipeline：
  ├─ 呼叫 Gemma 4 E4B → 生成 title / summary / tags
  └─ 立即回傳 { noteId, status: "processing" }
       │
       ▼
Side Panel 收到 noteId，顯示「處理中...」
       │
       ▼（AI 完成）
Gemma 4 E4B 回傳 JSON
       │
       ▼
EmbeddingGemma 向量化
       │
       ▼
寫入 notes 表（含向量），ai_status = "done"
       │
       ▼
Supabase Realtime 廣播 notes 更新事件
       │
       ▼
Side Panel 自動刷新，顯示摘要與標籤
```

### 9.2 RAG 查詢完整流程

```
使用者輸入自然語言查詢
       │
       ▼
呼叫 POST /api/search（附 JWT）
       │
       ▼
EmbeddingGemma 將查詢轉為 768 維向量
       │
       ▼
pgvector 時間加權餘弦相似度搜尋（top-5）
       │
       ▼
取得 top-5 筆記的 ai_summary 作為 Context
       │
       ▼
Gemma 4 E4B：Context + 原始問題 → 生成自然語言回答
       │
       ▼
回傳 { answer, sourceNotes }
       │
       ▼
儀表板顯示：AI 回答（Markdown）+ 相關筆記卡片
```

---

## 10. 部署架構

### 10.1 環境配置

| 環境 | 服務 | URL |
|------|------|-----|
| 開發 | 本地 Node.js + Supabase Local | http://localhost:3000 |
| 生產 | Vercel Hobby + Supabase Cloud | https://memory-app.vercel.app |

### 10.2 環境變數

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...（公開，前端用）
SUPABASE_SERVICE_ROLE_KEY=eyJ...（私密，後端用，不得洩漏）

# Gemma AI API
GEMMA_API_KEY=...
GEMMA_API_URL=https://generativelanguage.googleapis.com/v1beta/

# 速率限制
RATE_LIMIT_AI_PER_MIN=30

# 日報 Cron（Vercel Cron）
CRON_SECRET=...（驗證 cron job 來源）
```

### 10.3 Vercel 配置（vercel.json）

```json
{
  "crons": [{
    "path": "/api/reports/cron-generate",
    "schedule": "0 0 * * *"
  }],
  "functions": {
    "api/notes/image.ts": {
      "maxDuration": 30
    },
    "api/search.ts": {
      "maxDuration": 30
    }
  }
}
```

---

## 11. 錯誤處理規格

### 11.1 錯誤碼定義

| 錯誤碼 | HTTP 狀態 | 說明 |
|--------|---------|------|
| `UNAUTHORIZED` | 401 | JWT 無效或過期 |
| `FORBIDDEN` | 403 | 存取非本人資源 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `MISSING_FIELD` | 400 | 必填欄位缺漏 |
| `FILE_TOO_LARGE` | 413 | 圖片超過大小限制 |
| `RATE_LIMIT` | 429 | AI API 呼叫超過速率限制 |
| `AI_FAILED` | 502 | Gemma API 呼叫失敗 |
| `EMBED_FAILED` | 502 | Embedding 失敗 |
| `DB_ERROR` | 500 | 資料庫操作失敗 |

### 11.2 降級策略

| 故障情境 | 降級行為 |
|---------|---------|
| Gemma 摘要 API 失敗 | 儲存原始文字，ai_status = "failed"，前端顯示「AI 摘要暫時無法使用，原文已儲存」 |
| Embedding 失敗 | 筆記仍可儲存與顯示，但無法參與語意搜尋，前端顯示警告圖示 |
| 截圖 CORS 錯誤 | 自動降級至文字輸入模式，提示「無法自動處理圖片，請貼入文字內容」 |
| OCR 信心度 low | 顯示辨識結果但附帶「⚠ 辨識結果可能不完整，建議手動確認」提示 |
| pgvector 搜尋超時 | 自動切換為關鍵字搜尋，回傳結果附帶「目前使用關鍵字模式」說明 |
| Supabase Realtime 斷線 | 改為輪詢（每 5 秒 GET /api/notes/:id 查詢 ai_status） |

### 11.3 MV3 Service Worker 保持活躍

```javascript
// background.js
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 }); // 每 24 秒

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // 執行輕量操作，防止 SW 休眠
    chrome.storage.local.get('heartbeat');
  }
});
```

---

## 附錄 A：AI 品質驗收 Golden Set 規格

### 文字摘要 Golden Set（15 筆）

| 評分維度 | 說明 | 達標標準 |
|---------|------|---------|
| 相關性 | 摘要是否準確反映原文核心 | ≥ 4/5 分 |
| 完整性 | 是否涵蓋所有重要資訊點 | ≥ 4/5 分 |
| 精簡性 | 是否無冗贅內容 | ≥ 4/5 分 |
| **整體達標** | 三維度平均 ≥ 4/5 | **≥ 80% 筆記達標** |

### OCR Golden Set（10 筆）

| 類型 | 數量 | 說明 |
|------|------|------|
| 投影片截圖 | 3 筆 | 清晰文字 |
| 電子書截圖 | 2 筆 | 中等解析度 |
| 手機截圖 | 2 筆 | 混合語言 |
| 低解析度截圖 | 2 筆 | 模糊邊緣情境 |
| 中文手寫（選測） | 1 筆 | 進階情境 |
| **整體達標** | 辨識正確率 | **≥ 85%** |

---

## 附錄 B：專案開發時程建議

| 週次 | 里程碑 | 關鍵交付物 |
|------|--------|---------|
| Week 1 | 環境建置 | Supabase 設定、Extension 骨架、資料表建立 |
| Week 2 | 核心擷取流程 | 文字右鍵擷取 → AI 摘要 → 儲存完整流程 |
| **Week 3** | **E2E 強制測試** | 文字 + 截圖 OCR 兩條路徑均通過 E2E |
| Week 4 | 向量搜尋 | EmbeddingGemma 整合、pgvector 查詢 |
| Week 5 | RAG 查詢 | 語意搜尋 + AI 彙整回答 |
| Week 6 | 儀表板 | React Dashboard、筆記列表、篩選 |
| Week 7 | 日報生成 | 日報 Pipeline、Cron Job、日報頁面 |
| Week 8 | 品質驗收 | Golden Set 測試、效能調校、文件完善 |

---

*文件結束 — MemoRy Technical Specification v1.0*
