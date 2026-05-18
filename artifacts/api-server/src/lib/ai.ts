import { AppError, ERROR_CODES } from "./errors.js";

// ─── 設定（Ollama 優先，沒有則 fallback 到 Google AI）───────────────────────
const OLLAMA_BASE    = process.env.OLLAMA_BASE_URL;
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL        ?? "gemma3:4b";
const OLLAMA_EMBED   = process.env.OLLAMA_EMBED_MODEL  ?? "nomic-embed-text";

const GOOGLE_KEY     = process.env.GEMMA_API_KEY;
const GOOGLE_GEN_URL = process.env.GEMMA_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent";
const GOOGLE_EMBED_URL = process.env.GEMMA_EMBED_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

const USE_OLLAMA = Boolean(OLLAMA_BASE);

// ─── Ollama helpers ───────────────────────────────────────────────────────────

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

async function ollamaChat(
  messages: OllamaMessage[],
  jsonMode = false,
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      ...(jsonMode ? { format: "json" } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`Ollama error: ${err}`, ERROR_CODES.AI_ERROR, 500);
  }
  const data = await res.json() as { message?: { content?: string } };
  return data.message?.content ?? "";
}

async function ollamaEmbed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED, input: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`Ollama embed error: ${err}`, ERROR_CODES.AI_ERROR, 500);
  }
  const data = await res.json() as { embeddings?: number[][] };
  return data.embeddings?.[0] ?? [];
}

// ─── Google AI helpers ────────────────────────────────────────────────────────

async function googleFetch(url: string, body: object, retries = 2): Promise<Response> {
  if (!GOOGLE_KEY) {
    throw new AppError("GEMMA_API_KEY not configured", ERROR_CODES.AI_ERROR, 500);
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${url}?key=${GOOGLE_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
        throw new AppError(`Google AI error: ${err}`, ERROR_CODES.AI_ERROR, 500);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
    }
  }
  if (lastError instanceof AppError) throw lastError;
  throw new AppError("Google AI unreachable", ERROR_CODES.AI_ERROR, 500);
}

function googleExtractText(data: unknown): string {
  const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

export interface SummarizeResult {
  title: string;
  summary: string;
  tags: string[];
}

export async function summarizeText(text: string): Promise<SummarizeResult> {
  const prompt = `請分析以下文字，輸出 JSON（不含 Markdown 代碼塊）：
{"title":"簡短標題","summary":"3-5句摘要","tags":["標籤1","標籤2"]}

${text}`;

  let raw: string;

  if (USE_OLLAMA) {
    raw = await ollamaChat(
      [
        { role: "system", content: "你是一個知識整理助手。請用繁體中文回應。只輸出合法 JSON，不含任何說明文字。" },
        { role: "user", content: prompt },
      ],
      true,
    );
  } else {
    const res = await googleFetch(GOOGLE_GEN_URL, {
      system_instruction: { parts: [{ text: "你是一個知識整理助手。請用繁體中文回應。輸出格式必須是合法的 JSON，不含 Markdown 代碼塊。" }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    const data = await res.json();
    raw = googleExtractText(data);
  }

  try {
    return JSON.parse(raw) as SummarizeResult;
  } catch {
    // Gemma sometimes wraps JSON in ```json ... ```
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as SummarizeResult;
    throw new AppError("AI 回傳格式錯誤", ERROR_CODES.AI_ERROR, 500);
  }
}

export async function ocrImage(imageBase64: string): Promise<string> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  if (USE_OLLAMA) {
    return ollamaChat([
      {
        role: "user",
        content: "請提取圖片中的所有文字，只回傳純文字內容，不加任何說明。",
        images: [base64Data],
      },
    ]);
  }

  const res = await googleFetch(GOOGLE_GEN_URL, {
    contents: [{
      role: "user",
      parts: [
        { text: "請提取圖片中的所有文字，只回傳純文字內容，不加任何說明。" },
        { inline_data: { mime_type: "image/png", data: base64Data } },
      ],
    }],
  });
  const data = await res.json();
  return googleExtractText(data);
}

export async function embedText(text: string, _taskType = "RETRIEVAL_DOCUMENT"): Promise<number[]> {
  if (USE_OLLAMA) {
    return ollamaEmbed(text);
  }

  const res = await googleFetch(GOOGLE_EMBED_URL, {
    model: "models/text-embedding-004",
    content: { parts: [{ text }] },
    taskType: _taskType,
  });
  const data = await res.json() as { embedding?: { values?: number[] } };
  return data.embedding?.values ?? [];
}

export interface RagContext {
  title: string;
  summary: string;
  sourceUrl?: string;
}

export async function ragAnswer(query: string, contexts: RagContext[]): Promise<string> {
  const contextText = contexts
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.summary}`)
    .join("\n\n");

  const userPrompt = `根據以下筆記回答問題：\n\n${contextText}\n\n問題：${query}`;

  if (USE_OLLAMA) {
    return ollamaChat([
      { role: "system", content: "你是一個知識問答助手，根據提供的筆記內容回答問題。請用繁體中文回應。" },
      { role: "user", content: userPrompt },
    ]);
  }

  const res = await googleFetch(GOOGLE_GEN_URL, {
    system_instruction: { parts: [{ text: "你是一個知識問答助手，根據提供的筆記內容回答問題。請用繁體中文回應。" }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  });
  const data = await res.json();
  return googleExtractText(data);
}

export interface ReportNote {
  title: string;
  summary: string;
  tags: string[];
}

export interface DailyReportResult {
  keyLearnings: string[];
  crossDomain: string;
  suggestions: string[];
}

export async function generateDailyReport(notes: ReportNote[]): Promise<DailyReportResult> {
  const notesText = notes.map((n) => `- ${n.title}: ${n.summary} [${n.tags.join(", ")}]`).join("\n");
  const prompt = `分析今日筆記，輸出 JSON（不含 Markdown 代碼塊）：
{"keyLearnings":["要點1","要點2"],"crossDomain":"跨域分析","suggestions":["建議1","建議2"]}

${notesText}`;

  let raw: string;

  if (USE_OLLAMA) {
    raw = await ollamaChat(
      [
        { role: "system", content: "你是一個學習分析助手。請用繁體中文回應。只輸出合法 JSON，不含任何說明文字。" },
        { role: "user", content: prompt },
      ],
      true,
    );
  } else {
    const res = await googleFetch(GOOGLE_GEN_URL, {
      system_instruction: { parts: [{ text: "你是一個學習分析助手。請用繁體中文回應。輸出格式必須是合法的 JSON，不含 Markdown 代碼塊。" }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    const data = await res.json();
    raw = googleExtractText(data);
  }

  try {
    return JSON.parse(raw) as DailyReportResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as DailyReportResult;
    throw new AppError("AI 回傳格式錯誤", ERROR_CODES.AI_ERROR, 500);
  }
}
