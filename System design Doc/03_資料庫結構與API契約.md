# MemoRy — 資料庫結構與 API 契約

## 1. 資料庫結構

### 1.1 `notes` 表

```sql
CREATE TABLE notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  source_url   TEXT,
  source_title TEXT,
  source_text  TEXT,
  ocr_text     TEXT,
  ai_title     TEXT,
  ai_summary   TEXT,
  user_note    TEXT,
  tags         TEXT[]   NOT NULL DEFAULT '{}',
  note_type    TEXT     NOT NULL DEFAULT 'text',  -- 'text' | 'image'
  ai_status    TEXT     NOT NULL DEFAULT 'pending', -- 'pending' | 'done' | 'failed'
  embedding    vector(768),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notes_user_id_idx ON notes(user_id);
CREATE INDEX notes_created_at_idx ON notes(created_at DESC);
CREATE INDEX notes_embedding_idx ON notes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Drizzle Schema**（`lib/db/src/schema/notes.ts`）：

```typescript
export const notesTable = pgTable("notes", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull(),
  sourceUrl:   text("source_url"),
  sourceTitle: text("source_title"),
  sourceText:  text("source_text"),
  ocrText:     text("ocr_text"),
  aiTitle:     text("ai_title"),
  aiSummary:   text("ai_summary"),
  userNote:    text("user_note"),
  tags:        text("tags").array().notNull().default(sql`'{}'::text[]`),
  noteType:    text("note_type").notNull().default("text"),
  aiStatus:    text("ai_status").notNull().default("pending"),
  embedding:   vectorColumn("embedding", { dimensions: 768 }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

> `vectorColumn` 為自定義 customType，`toDriver` 輸出 `[x,y,...]` 格式；SQL 查詢需加 `::vector` cast。

---

### 1.2 `tags` 表

```sql
CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  use_count  INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
```

**用途**：快取使用者曾用過的標籤，支援前端自動補全。每次筆記儲存標籤時 upsert。

---

### 1.3 `daily_reports` 表

```sql
CREATE TABLE daily_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  report_date   DATE NOT NULL,
  key_learnings TEXT[] NOT NULL DEFAULT '{}',
  cross_domain  TEXT,
  suggestions   TEXT[] NOT NULL DEFAULT '{}',
  diary_text    TEXT,
  note_ids      TEXT[] NOT NULL DEFAULT '{}',
  note_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_date)
);
```

**欄位說明**：

| 欄位 | 說明 |
|------|------|
| `key_learnings` | AI 生成的當日學習要點（3-5 條） |
| `cross_domain` | AI 跨領域聯想分析（Markdown 文字） |
| `suggestions` | AI 建議的延伸閱讀或行動（2-3 條） |
| `diary_text` | 使用者手寫日記（選填） |
| `note_ids` | 當日筆記的 UUID 列表 |

---

### 1.4 pgvector 設定

```bash
# 必須在 DB push 前手動執行一次
CREATE EXTENSION IF NOT EXISTS vector;
```

**向量搜尋 SQL 範本**：

```sql
-- 時間加權 cosine 相似度搜尋
SELECT id, ai_title, ai_summary, tags,
       embedding <=> $1::vector AS distance,
       EXTRACT(EPOCH FROM (now() - created_at)) / 86400 AS days_old
FROM notes
WHERE user_id = $2
  AND embedding IS NOT NULL
ORDER BY distance * (1 + 0.01 * EXTRACT(EPOCH FROM (now() - created_at)) / 86400)
LIMIT 10;
```

---

## 2. API 契約

> 完整 OpenAPI 3.1 規格在 `lib/api-spec/openapi.yaml`，以下為摘要。

### 2.1 通用規則

- **Base URL**：`/api`
- **認證**：所有端點（除 `/healthz`）需 `Authorization: Bearer <supabase_jwt>`
- **Content-Type**：`application/json`
- **時間格式**：ISO 8601（`2024-01-15T10:30:00Z`）
- **日期格式**：`YYYY-MM-DD`（`2024-01-15`）

### 2.2 通用回應格式

**成功**：
```json
{ "data": "...", "meta": { "page": 1, "total": 42 } }
```

**錯誤**：
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Note not found"
  }
}
```

---

### 2.3 Notes API

#### `GET /api/notes`

列出筆記（分頁）。

**Query 參數**：

| 參數 | 型別 | 說明 |
|------|------|------|
| `page` | integer | 頁碼，預設 1 |
| `limit` | integer | 每頁筆數，最大 100，預設 20 |
| `sort` | string | `created_at_desc`（預設）\| `created_at_asc` |
| `tags` | string | 逗號分隔，如 `AI,機器學習` |
| `domain` | string | 來源網域過濾，如 `github.com` |
| `dateFrom` | string | 開始日期（ISO 8601） |
| `dateTo` | string | 結束日期（ISO 8601） |

**回應**：
```json
{
  "notes": [
    {
      "id": "uuid",
      "aiTitle": "文章標題",
      "aiSummary": "AI 摘要...",
      "tags": ["AI", "機器學習"],
      "sourceUrl": "https://example.com",
      "sourceTitle": "網頁標題",
      "noteType": "text",
      "aiStatus": "done",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

#### `POST /api/notes/text`

建立文字筆記（AI 非同步處理）。

**Request Body**：
```json
{
  "sourceUrl": "https://example.com/article",
  "sourceTitle": "網頁標題",
  "sourceText": "擷取的文字內容...",
  "userNote": "使用者備注（選填）"
}
```

**回應** `201`：
```json
{
  "noteId": "uuid",
  "aiStatus": "pending"
}
```

---

#### `POST /api/notes/image`

建立圖片筆記（OCR + AI 非同步處理）。

**Request Body**：
```json
{
  "sourceUrl": "https://example.com",
  "sourceTitle": "網頁標題",
  "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
  "userNote": "使用者備注（選填）"
}
```

**回應** `201`：
```json
{
  "noteId": "uuid",
  "aiStatus": "pending"
}
```

---

#### `GET /api/notes/:id`

取得單一筆記（含相關筆記推薦）。

**回應**：
```json
{
  "id": "uuid",
  "aiTitle": "...",
  "aiSummary": "...",
  "sourceText": "原始文字",
  "ocrText": "OCR 文字",
  "userNote": "...",
  "tags": ["AI"],
  "sourceUrl": "...",
  "noteType": "text",
  "aiStatus": "done",
  "createdAt": "...",
  "updatedAt": "...",
  "relatedNotes": [
    { "id": "uuid", "aiTitle": "...", "aiSummary": "..." }
  ]
}
```

---

#### `PATCH /api/notes/:id`

更新筆記（標題、摘要、備注、標籤）。若 AI 相關欄位變更，自動重新 embedding。

**Request Body**：
```json
{
  "aiTitle": "更新標題",
  "aiSummary": "更新摘要",
  "userNote": "更新備注",
  "tags": ["新標籤"]
}
```

**回應**：
```json
{
  "noteId": "uuid",
  "reembedding": true
}
```

---

#### `DELETE /api/notes/:id`

刪除筆記。回應 `204 No Content`。

---

### 2.4 Search API

#### `POST /api/search`

語意搜尋（RAG）：向量召回 → LLM 彙整答案。

**Request Body**：
```json
{
  "query": "什麼是 Transformer 注意力機制？",
  "topK": 5,
  "dateFrom": "2024-01-01",
  "dateTo": "2024-12-31"
}
```

**回應**：
```json
{
  "answer": "根據你的筆記...(LLM 彙整)",
  "sources": [
    {
      "id": "uuid",
      "aiTitle": "...",
      "aiSummary": "...",
      "score": 0.87,
      "createdAt": "..."
    }
  ]
}
```

---

#### `GET /api/search/keyword`

關鍵字全文搜尋（不用 AI）。

**Query**：`?q=Transformer&page=1&limit=20`

**回應**：同 `/api/notes` 列表格式。

---

### 2.5 Reports API

#### `GET /api/reports`

列出日報（分頁）。

**Query**：`?page=1&limit=10`

---

#### `POST /api/reports/generate`

觸發 AI 生成指定日期日報。

**Request Body**：
```json
{
  "date": "2024-01-15"
}
```

**回應** `201`：
```json
{
  "id": "uuid",
  "reportDate": "2024-01-15",
  "keyLearnings": ["要點 1", "要點 2"],
  "crossDomain": "跨域分析 Markdown...",
  "suggestions": ["建議 1", "建議 2"],
  "noteCount": 8
}
```

---

#### `GET /api/reports/:date`

取得指定日期日報（含筆記卡片）。

---

#### `PATCH /api/reports/:date/diary`

更新日記文字。

**Request Body**：
```json
{
  "diaryText": "今天學到了..."
}
```

---

### 2.6 Tags API

#### `GET /api/tags`

取得使用者所有標籤（依使用次數排序）。

**回應**：
```json
{
  "tags": [
    { "name": "AI", "useCount": 42 },
    { "name": "機器學習", "useCount": 28 }
  ]
}
```

---

### 2.7 Export API

#### `GET /api/export`

匯出所有筆記。

**Query**：`?format=json` 或 `?format=markdown`

**回應（json）**：
```json
{
  "exportedAt": "2024-01-15T10:30:00Z",
  "totalNotes": 100,
  "notes": [ ...所有筆記完整資料... ]
}
```

**回應（markdown）**：`Content-Type: text/markdown`，單一 `.md` 檔案。

---

### 2.8 Health Check

#### `GET /api/healthz`

**回應**：
```json
{ "status": "ok" }
```
