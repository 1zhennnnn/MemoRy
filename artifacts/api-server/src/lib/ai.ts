import { AppError, ERROR_CODES } from "./errors.js";

// ── Groq (OpenAI-compatible) — fast text inference ────────────────────────────
const GROQ_KEY   = process.env.GROQ_API_KEY;
const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// ── Gemini — vision OCR + embedding ──────────────────────────────────────────
const GOOGLE_KEY     = process.env.GEMINI_API_KEY ?? process.env.GEMMA_API_KEY;
const GEMINI_VIS_URL = process.env.GEMINI_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_EMB_URL = process.env.GEMINI_EMBED_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent";

// ── Groq helpers ──────────────────────────────────────────────────────────────

interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

async function groqChat(messages: ChatMessage[], jsonMode = false): Promise<string> {
  if (!GROQ_KEY) throw new AppError("GROQ_API_KEY not configured", ERROR_CODES.AI_ERROR, 500);
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new AppError(`Groq error: ${await res.text()}`, ERROR_CODES.AI_ERROR, 500);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

// ── Gemini helpers ────────────────────────────────────────────────────────────

async function geminiPost(url: string, body: object, retries = 2): Promise<Response> {
  if (!GOOGLE_KEY) throw new AppError("GEMINI_API_KEY not configured", ERROR_CODES.AI_ERROR, 500);
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${url}?key=${GOOGLE_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429 && i < retries) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
          continue;
        }
        throw new AppError(`Gemini error: ${err}`, ERROR_CODES.AI_ERROR, 500);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i === retries) break;
    }
  }
  if (lastErr instanceof AppError) throw lastErr;
  throw new AppError("Gemini unreachable", ERROR_CODES.AI_ERROR, 500);
}

function geminiText(data: unknown): string {
  const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SummarizeResult {
  title: string;
  summary: string;
  tags: string[];
}

export async function summarizeText(text: string): Promise<SummarizeResult> {
  const prompt = `請分析以下文字，輸出 JSON（不含 Markdown 代碼塊）：
{"title":"簡短標題","summary":"3-5句摘要","tags":["標籤1","標籤2"]}

${text}`;

  const raw = await groqChat([
    { role: "system", content: "你是一個知識整理助手。請用繁體中文回應。只輸出合法 JSON，不含任何說明文字。" },
    { role: "user", content: prompt },
  ], true);

  try {
    return JSON.parse(raw) as SummarizeResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as SummarizeResult;
    throw new AppError("AI 回傳格式錯誤", ERROR_CODES.AI_ERROR, 500);
  }
}

export async function ocrImage(imageBase64: string): Promise<string> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/png";
  const res = await geminiPost(GEMINI_VIS_URL, {
    contents: [{ role: "user", parts: [
      {
        text: "請分析這張圖片。如果圖片中有文字，提取所有文字內容。如果沒有文字或文字很少，請描述圖片的主要內容、主題和重要視覺元素。只輸出提取的文字或描述，不加任何說明前綴。",
      },
      { inline_data: { mime_type: mimeType, data: base64Data } },
    ]}],
  });
  const text = geminiText(await res.json());
  if (!text.trim()) throw new Error("Gemini vision returned empty response");
  return text;
}

export async function embedText(text: string, _taskType = "RETRIEVAL_DOCUMENT"): Promise<number[]> {
  const res = await geminiPost(GEMINI_EMB_URL, {
    model: "models/gemini-embedding-2",
    content: { parts: [{ text }] },
    taskType: _taskType,
  });
  const data = await res.json() as { embedding?: { values?: number[] } };
  return data.embedding?.values ?? [];
}

export interface RagContext { title: string; summary: string; sourceUrl?: string; distance?: number; }

export async function ragAnswer(query: string, contexts: RagContext[]): Promise<string> {
  const contextText = contexts
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.summary}`)
    .join("\n\n");
  return groqChat([
    {
      role: "system",
      content:
        "你是一個知識問答助手，只能根據使用者提供的筆記內容回答問題。" +
        "請用繁體中文回應。" +
        "如果提供的筆記與問題不相關，請直接回覆「我的筆記庫中沒有關於這個主題的相關記錄。」，不要編造答案。" +
        "回答時請引用來源編號，例如「根據筆記[1]...」。",
    },
    {
      role: "user",
      content: `以下是從筆記庫中找到的相關筆記：\n\n${contextText}\n\n問題：${query}`,
    },
  ]);
}

export interface ReportNote { title: string; summary: string; tags: string[]; }
export interface DailyReportResult { keyLearnings: string[]; crossDomain: string; suggestions: string[]; }

export async function generateDailyReport(notes: ReportNote[]): Promise<DailyReportResult> {
  const notesText = notes.map((n) => `- ${n.title}: ${n.summary} [${n.tags.join(", ")}]`).join("\n");
  const prompt = `分析今日筆記，輸出 JSON（不含 Markdown 代碼塊）：
{"keyLearnings":["要點1","要點2"],"crossDomain":"跨域分析","suggestions":["建議1","建議2"]}

${notesText}`;

  const raw = await groqChat([
    { role: "system", content: "你是一個學習分析助手。請用繁體中文回應。只輸出合法 JSON，不含任何說明文字。" },
    { role: "user", content: prompt },
  ], true);

  try {
    return JSON.parse(raw) as DailyReportResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as DailyReportResult;
    throw new AppError("AI 回傳格式錯誤", ERROR_CODES.AI_ERROR, 500);
  }
}
