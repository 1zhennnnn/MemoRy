import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { embedText } from "../lib/ai.js";

const router: IRouter = Router();

const GEMMA_KEY = process.env.GEMINI_API_KEY ?? process.env.GEMMA_API_KEY;
const AGENT_MODEL_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// ── Note search via embedding ─────────────────────────────────────────────────

interface NoteSource { id: string; title: string | null; summary: string | null; score?: number; }

async function searchNotes(userId: string, query: string, topK = 6): Promise<{ notes: NoteSource[]; text: string }> {
  try {
    const queryVector = await embedText(query);
    if (!queryVector.length) return { notes: [], text: "（無嵌入向量）" };
    const vectorStr = `[${queryVector.join(",")}]`;
    const rows = await db.execute<{ id: string; ai_title: string | null; ai_summary: string | null; distance: number }>(
      sql`
        SELECT id, ai_title, ai_summary,
               (embedding <=> ${vectorStr}::vector) AS distance
        FROM notes
        WHERE user_id = ${userId}
          AND embedding IS NOT NULL
          AND ai_status = 'done'
          AND (embedding <=> ${vectorStr}::vector) < 0.75
        ORDER BY distance ASC LIMIT ${topK}
      `,
    );
    type Row = { id: string; ai_title: string | null; ai_summary: string | null; distance: number };
    const notes = (rows as unknown as Row[]).map((r) => ({
      id: r.id, title: r.ai_title, summary: r.ai_summary,
      score: Math.round((1 - r.distance) * 100) / 100,
    }));
    const text = notes.length
      ? notes.map((n, i) => `[筆記${i + 1}] ${n.title ?? "無標題"}\n${n.summary ?? ""}`).join("\n\n")
      : "筆記庫中未找到相關內容。";
    return { notes, text };
  } catch {
    return { notes: [], text: "筆記搜尋暫時無法使用。" };
  }
}

// ── Gemini call with google_search only ──────────────────────────────────────
// NOTE: Gemini does NOT allow mixing function_declarations + google_search in
// the same request. We therefore search notes via embedding (above) and inject
// the results as context, then let Gemini use google_search for web content.

interface GeminiMessage { role: "user" | "model"; parts: Array<{ text: string }> }
interface GroundingChunk { web?: { uri: string; title: string } }

async function callWithGoogleSearch(
  contents: GeminiMessage[],
  system: string,
): Promise<{ answer: string; webSources: GroundingChunk[] }> {
  if (!GEMMA_KEY) throw new AppError("AI API key not configured", ERROR_CODES.AI_ERROR, 500);
  const res = await fetch(`${AGENT_MODEL_URL}?key=${GEMMA_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      tools: [{ google_search: {} }],
      contents,
    }),
  });
  if (!res.ok) {
    throw new AppError(`Gemini error ${res.status}: ${await res.text()}`, ERROR_CODES.AI_ERROR, 500);
  }
  type Part = { text?: string; thought?: boolean };
  const data = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Part[] };
      groundingMetadata?: { groundingChunks?: GroundingChunk[] };
    }>;
  };
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const answer = parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text!)
    .join("")
    .trim() || "無法生成回答。";
  const webSources = candidate?.groundingMetadata?.groundingChunks?.filter((c) => c.web) ?? [];
  return { answer, webSources };
}

// ── Route ─────────────────────────────────────────────────────────────────────

interface ChatMessage { role: "user" | "assistant"; content: string; }

router.post("/agent/chat", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { messages } = req.body as { messages?: ChatMessage[] };
    if (!messages?.length) throw new AppError("messages is required", ERROR_CODES.MISSING_FIELD, 400);

    // Use the latest user message as the search query
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Step 1: Search notes with embedding (fast, no LLM)
    const { notes, text: notesText } = await searchNotes(userId, lastUserMsg);

    // Step 2: Inject note results into system prompt
    const notesSection = notes.length
      ? `\n\n## 使用者個人筆記庫（已找到相關內容）\n${notesText}\n\n引用筆記時使用格式：[筆記1]、[筆記2]。`
      : "\n\n## 使用者個人筆記庫\n（本次查詢未找到相關筆記）";

    const systemPrompt =
      `你是使用者的個人知識助手，能結合其筆記庫與最新網路資訊回答問題。
請用繁體中文回答。
若筆記庫有相關內容，請優先引用；同時可搜尋網路提供延伸資源或推薦。
若使用者問推薦看什麼，請搜尋網路找相關文章並列出。` + notesSection;

    // Step 3: Call Gemini with google_search for web results
    const contents: GeminiMessage[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const { answer, webSources } = await callWithGoogleSearch(contents, systemPrompt);

    res.json({ answer, sources: notes, webSources, toolCalls: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
