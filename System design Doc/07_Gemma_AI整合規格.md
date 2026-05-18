# MemoRy — Gemma AI 整合規格

## 1. 概覽

| 項目 | 說明 |
|------|------|
| 提供商 | Google AI Studio |
| 文字生成模型 | `gemma-3-4b-it`（指令微調版） |
| Embedding 模型 | `text-embedding-004`（輸出 768 維） |
| 認證方式 | URL Query Parameter `?key={GEMMA_API_KEY}` |
| 請求格式 | `application/json` |

---

## 2. 基礎設定

```typescript
// artifacts/api-server/src/lib/ai.ts

const GEMMA_API_URL =
  process.env.GEMMA_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent";

const GEMMA_EMBED_URL =
  process.env.GEMMA_EMBED_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

const GEMMA_API_KEY = process.env.GEMMA_API_KEY;

// 共用 fetch helper（含 retry）
async function gemmaFetch(url: string, body: object, retries = 2): Promise<Response> {
  if (!GEMMA_API_KEY) {
    throw new AppError("GEMMA_API_KEY not configured", ERROR_CODES.AI_ERROR, 500);
  }
  const endpoint = `${url}?key=${GEMMA_API_KEY}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429 && attempt < retries) {
          // Rate limit：等待後重試（exponential backoff）
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw new AppError(`Gemma API error: ${err}`, ERROR_CODES.AI_ERROR, 500);
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
  throw new AppError("Gemma API unreachable", ERROR_CODES.AI_ERROR, 500);
}
```

---

## 3. 函式規格

### 3.1 `summarizeText(text: string)`

**用途**：對擷取的網頁文字生成標題、摘要和標籤

**端點**：`GEMMA_API_URL`（generateContent）

**Request Body**：
```json
{
  "system_instruction": {
    "parts": [{
      "text": "你是一個知識整理助手。請用繁體中文回應。輸出格式必須是合法的 JSON，不含 Markdown 代碼塊。"
    }]
  },
  "contents": [{
    "role": "user",
    "parts": [{
      "text": "請分析以下文字，並以 JSON 格式回傳：\n{\"title\": \"簡潔的文章標題（15字內）\", \"summary\": \"核心要點摘要（100-150字）\", \"tags\": [\"標籤1\", \"標籤2\", \"標籤3\"]}\n\n標籤規則：2-5個，每個標籤2-6個字，優先使用技術術語或主題詞。\n\n文字內容：\n{{SOURCE_TEXT}}"
    }]
  }],
  "generationConfig": {
    "temperature": 0.3,
    "maxOutputTokens": 512,
    "responseMimeType": "application/json"
  }
}
```

**Response 解析**：
```typescript
interface SummarizeResult {
  title: string;
  summary: string;
  tags: string[];
}

async function summarizeText(text: string): Promise<SummarizeResult> {
  const truncated = text.slice(0, 8000); // 防止 token 超限
  const body = {
    system_instruction: {
      parts: [{ text: "你是一個知識整理助手。請用繁體中文回應。輸出格式必須是合法的 JSON，不含 Markdown 代碼塊。" }]
    },
    contents: [{
      role: "user",
      parts: [{
        text: `請分析以下文字，並以 JSON 格式回傳：\n{"title": "簡潔的文章標題（15字內）", "summary": "核心要點摘要（100-150字）", "tags": ["標籤1", "標籤2"]}\n\n文字內容：\n${truncated}`
      }]
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 }
  };

  const res = await gemmaFetch(GEMMA_API_URL, body);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
      title: String(parsed.title ?? "").slice(0, 100),
      summary: String(parsed.summary ?? "").slice(0, 500),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 5).map(String)
        : [],
    };
  } catch {
    throw new AppError("AI 摘要解析失敗", ERROR_CODES.AI_ERROR, 500);
  }
}
```

---

### 3.2 `ocrImage(imageBase64: string)`

**用途**：對截圖做 OCR，提取文字內容

**端點**：`GEMMA_API_URL`（generateContent，含 inline image）

**Request Body**：
```json
{
  "contents": [{
    "role": "user",
    "parts": [
      {
        "inline_data": {
          "mime_type": "image/png",
          "data": "{{BASE64_DATA_WITHOUT_PREFIX}}"
        }
      },
      {
        "text": "請提取這張圖片中所有可見的文字內容。保持原始段落結構，用換行分隔不同段落。只輸出提取的文字，不要加入任何說明或解釋。"
      }
    ]
  }],
  "generationConfig": {
    "temperature": 0.1,
    "maxOutputTokens": 2048
  }
}
```

**實作**：
```typescript
async function ocrImage(imageBase64: string): Promise<string> {
  // 移除 data URI prefix（如 "data:image/png;base64,"）
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  // 偵測 MIME type
  const mimeType = imageBase64.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";

  const body = {
    contents: [{
      role: "user",
      parts: [
        { inline_data: { mime_type: mimeType, data: base64Data } },
        { text: "請提取這張圖片中所有可見的文字內容。保持原始段落結構，用換行分隔不同段落。只輸出提取的文字，不要加入任何說明或解釋。" }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
  };

  const res = await gemmaFetch(GEMMA_API_URL, body);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!text.trim()) {
    throw new AppError("圖片中未能識別文字", ERROR_CODES.AI_ERROR, 500);
  }
  return text.trim();
}
```

---

### 3.3 `embedText(text: string)`

**用途**：將文字轉為 768 維向量，用於語意搜尋

**端點**：`GEMMA_EMBED_URL`（embedContent）

**Request Body**：
```json
{
  "model": "models/text-embedding-004",
  "content": {
    "parts": [{ "text": "{{TEXT_TO_EMBED}}" }]
  },
  "taskType": "RETRIEVAL_DOCUMENT"
}
```

**taskType 說明**：
| taskType | 使用時機 |
|----------|---------|
| `RETRIEVAL_DOCUMENT` | 儲存筆記時（建立向量） |
| `RETRIEVAL_QUERY` | 搜尋查詢時（查詢向量） |
| `SEMANTIC_SIMILARITY` | 相關筆記推薦 |

**實作**：
```typescript
async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY" = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const truncated = text.slice(0, 3000); // embedding 輸入限制
  const body = {
    model: "models/text-embedding-004",
    content: { parts: [{ text: truncated }] },
    taskType,
  };

  const res = await gemmaFetch(GEMMA_EMBED_URL, body);
  const data = await res.json();
  const values: number[] = data.embedding?.values;

  if (!Array.isArray(values) || values.length !== 768) {
    throw new AppError("Embedding 格式錯誤", ERROR_CODES.AI_ERROR, 500);
  }
  return values;
}
```

---

### 3.4 `ragAnswer(query: string, contexts: RagContext[])`

**用途**：根據召回的筆記脈絡，生成自然語言回答

**端點**：`GEMMA_API_URL`（generateContent）

**Request Body**：
```json
{
  "system_instruction": {
    "parts": [{
      "text": "你是用戶的個人知識助手。根據提供的筆記脈絡回答問題，只使用脈絡中的資訊。用繁體中文回答，回答要簡潔清晰（200字以內）。若脈絡不足以回答，說明「根據你目前的筆記，無法完整回答此問題」。"
    }]
  },
  "contents": [{
    "role": "user",
    "parts": [{
      "text": "問題：{{QUERY}}\n\n相關筆記脈絡：\n{{CONTEXTS}}"
    }]
  }],
  "generationConfig": {
    "temperature": 0.4,
    "maxOutputTokens": 512
  }
}
```

**實作**：
```typescript
interface RagContext {
  title: string;
  summary: string;
  sourceUrl?: string;
}

async function ragAnswer(query: string, contexts: RagContext[]): Promise<string> {
  const contextText = contexts
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.summary}${c.sourceUrl ? `\n來源：${c.sourceUrl}` : ""}`)
    .join("\n\n");

  const body = {
    system_instruction: {
      parts: [{ text: "你是用戶的個人知識助手。根據提供的筆記脈絡回答問題，只使用脈絡中的資訊。用繁體中文回答，回答要簡潔清晰（200字以內）。若脈絡不足以回答，說明「根據你目前的筆記，無法完整回答此問題」。" }]
    },
    contents: [{
      role: "user",
      parts: [{ text: `問題：${query}\n\n相關筆記脈絡：\n${contextText}` }]
    }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 512 }
  };

  const res = await gemmaFetch(GEMMA_API_URL, body);
  const data = await res.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!answer.trim()) {
    throw new AppError("AI 無法生成回答", ERROR_CODES.AI_ERROR, 500);
  }
  return answer.trim();
}
```

---

### 3.5 `generateDailyReport(notes: ReportNote[])`

**用途**：彙整當日筆記，生成知識日報

**端點**：`GEMMA_API_URL`（generateContent）

**Request Body**：
```json
{
  "system_instruction": {
    "parts": [{
      "text": "你是用戶的知識學習教練。根據用戶今日的學習筆記，生成一份有洞察力的每日知識日報。用繁體中文回應。輸出合法 JSON，不含 Markdown 代碼塊。"
    }]
  },
  "contents": [{
    "role": "user",
    "parts": [{
      "text": "今日筆記（{{COUNT}} 筆）：\n{{NOTES_TEXT}}\n\n請生成知識日報，格式：\n{\"keyLearnings\": [\"要點1（30字內）\", \"要點2\", \"要點3\"], \"crossDomain\": \"跨域聯想分析（Markdown格式，100-200字）\", \"suggestions\": [\"延伸建議1（30字內）\", \"延伸建議2\"]}"
    }]
  }],
  "generationConfig": {
    "temperature": 0.6,
    "maxOutputTokens": 1024
  }
}
```

**實作**：
```typescript
interface ReportNote {
  aiTitle: string;
  aiSummary: string;
  tags: string[];
}

interface DailyReportResult {
  keyLearnings: string[];
  crossDomain: string;
  suggestions: string[];
}

async function generateDailyReport(notes: ReportNote[]): Promise<DailyReportResult> {
  const notesText = notes
    .map((n, i) => `${i + 1}. ${n.aiTitle}（${n.tags.join("、")}）\n   ${n.aiSummary}`)
    .join("\n\n");

  const body = {
    system_instruction: {
      parts: [{ text: "你是用戶的知識學習教練。根據用戶今日的學習筆記，生成一份有洞察力的每日知識日報。用繁體中文回應。輸出合法 JSON，不含 Markdown 代碼塊。" }]
    },
    contents: [{
      role: "user",
      parts: [{ text: `今日筆記（${notes.length} 筆）：\n${notesText}\n\n請生成知識日報，格式：\n{"keyLearnings": ["要點1（30字內）"], "crossDomain": "跨域聯想（Markdown，100-200字）", "suggestions": ["建議1"]}` }]
    }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 1024 }
  };

  const res = await gemmaFetch(GEMMA_API_URL, body);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
      keyLearnings: Array.isArray(parsed.keyLearnings)
        ? parsed.keyLearnings.slice(0, 5).map(String)
        : [],
      crossDomain: String(parsed.crossDomain ?? ""),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map(String)
        : [],
    };
  } catch {
    throw new AppError("日報生成解析失敗", ERROR_CODES.AI_ERROR, 500);
  }
}
```

---

## 4. 背景 Embedding 觸發器

```typescript
// 筆記建立後呼叫，背景執行（不等待）
async function triggerEmbedding(noteId: string, text: string): Promise<void> {
  try {
    const vector = await embedText(text, "RETRIEVAL_DOCUMENT");
    await db.update(notesTable)
      .set({ embedding: vector, aiStatus: "done" })
      .where(eq(notesTable.id, noteId));
    logger.info({ noteId }, "Embedding 完成");
  } catch (err) {
    logger.error({ err, noteId }, "Embedding 失敗");
    await db.update(notesTable)
      .set({ aiStatus: "failed" })
      .where(eq(notesTable.id, noteId));
  }
}

// 筆記建立後，AI 摘要 + Embedding 一起觸發
async function triggerAiProcessing(noteId: string, sourceText: string): Promise<void> {
  try {
    // 1. 摘要
    const { title, summary, tags } = await summarizeText(sourceText);
    await db.update(notesTable)
      .set({ aiTitle: title, aiSummary: summary, tags })
      .where(eq(notesTable.id, noteId));

    // 2. Embedding（用摘要 + 標題）
    const embedInput = `${title}\n${summary}\n${tags.join(" ")}`;
    const vector = await embedText(embedInput, "RETRIEVAL_DOCUMENT");
    await db.update(notesTable)
      .set({ embedding: vector, aiStatus: "done" })
      .where(eq(notesTable.id, noteId));

    // 3. 更新標籤計數
    for (const tag of tags) {
      await db.insert(tagsTable)
        .values({ userId: /* 需從 note 取得 */ "", name: tag, useCount: 1 })
        .onConflictDoUpdate({
          target: [tagsTable.userId, tagsTable.name],
          set: { useCount: sql`${tagsTable.useCount} + 1` }
        });
    }

    logger.info({ noteId }, "AI 處理完成");
  } catch (err) {
    logger.error({ err, noteId }, "AI 處理失敗");
    await db.update(notesTable)
      .set({ aiStatus: "failed" })
      .where(eq(notesTable.id, noteId));
  }
}
```

---

## 5. 時間加權向量搜尋

```typescript
// POST /api/search — RAG 端點
async function vectorSearch(
  userId: string,
  queryVector: number[],
  topK: number = 5,
  dateFrom?: string,
  dateTo?: string
): Promise<SearchResult[]> {
  const vectorStr = `[${queryVector.join(",")}]`;

  let dateFilter = "";
  const params: unknown[] = [userId, vectorStr, topK];

  if (dateFrom) {
    params.push(dateFrom);
    dateFilter += ` AND created_at >= $${params.length}::date`;
  }
  if (dateTo) {
    params.push(dateTo);
    dateFilter += ` AND created_at <= $${params.length}::date`;
  }

  // 時間加權：近期筆記相同相似度下優先顯示
  const results = await db.execute(sql`
    SELECT
      id, ai_title, ai_summary, tags, source_url, created_at,
      embedding <=> ${vectorStr}::vector AS distance,
      EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS days_old
    FROM notes
    WHERE user_id = ${userId}
      AND embedding IS NOT NULL
      AND ai_status = 'done'
    ORDER BY
      (embedding <=> ${vectorStr}::vector) * (1 + 0.01 * EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)
    LIMIT ${topK}
  `);

  return results.rows as SearchResult[];
}
```

---

## 6. 錯誤處理策略

| 情況 | 行為 |
|------|------|
| API Key 未設定 | 拋出 `AppError(AI_ERROR)`，筆記仍建立，`aiStatus = "failed"` |
| 429 Rate Limit | Exponential backoff retry（最多 2 次），仍失敗則 `aiStatus = "failed"` |
| 回應格式錯誤 | JSON parse catch，拋出 `AppError`，`aiStatus = "failed"` |
| 圖片無文字 | 拋出 `AppError`，OCR 欄位為 null，`aiStatus = "failed"` |
| 網路超時 | fetch 預設超時，catch 後 `aiStatus = "failed"` |

**核心原則**：任何 AI 失敗都不影響筆記資料的完整性，`sourceText` / `ocrText` 永遠保留。

---

## 7. 速率限制參考

Google AI Studio 免費額度（截至 2025）：
- `gemma-3-4b-it`：15 RPM（requests per minute），1M TPD（tokens per day）
- `text-embedding-004`：1500 RPM，100 RPD（requests per day）

建議：
- 批次 Embedding 時加入 100ms delay between requests
- 日報生成排程在離峰時段（午夜）執行
