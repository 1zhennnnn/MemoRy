import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db/schema";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { embedText, ragAnswer } from "../lib/ai.js";

const router: IRouter = Router();

router.post("/search", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { query, topK = 5, dateFrom, dateTo } = req.body as {
      query?: string;
      topK?: number;
      dateFrom?: string;
      dateTo?: string;
    };

    if (!query) {
      throw new AppError("query is required", ERROR_CODES.MISSING_FIELD, 400);
    }

    const queryVector = await embedText(query, "RETRIEVAL_QUERY");
    const vectorStr = `[${queryVector.join(",")}]`;

    const dateFromClause = dateFrom ? sql`AND created_at >= ${new Date(dateFrom)}` : sql``;
    const dateToClause   = dateTo   ? sql`AND created_at <= ${new Date(dateTo)}`   : sql``;

    const rows = await db.execute<{
      id: string;
      ai_title: string | null;
      ai_summary: string | null;
      tags: string[];
      source_url: string | null;
      created_at: string;
      score: number;
    }>(
      sql`
        SELECT id, ai_title, ai_summary, tags, source_url, created_at,
               (embedding <=> ${vectorStr}::vector)
                 * (1 + 0.01 * EXTRACT(EPOCH FROM (now() - created_at)) / 86400) AS score
        FROM notes
        WHERE user_id = ${userId}
          AND embedding IS NOT NULL
          AND ai_status = 'done'
          ${dateFromClause}
          ${dateToClause}
        ORDER BY score ASC
        LIMIT ${topK}
      `,
    );

    type SearchRow = { id: string; ai_title: string | null; ai_summary: string | null; tags: string[]; source_url: string | null; created_at: string; score: number };
    const rowArr = rows as unknown as SearchRow[];

    const sources = rowArr.map((r) => ({
      id:         r.id,
      aiTitle:    r.ai_title,
      aiSummary:  r.ai_summary,
      score:      Math.round((1 - r.score) * 100) / 100,
      createdAt:  r.created_at,
    }));

    const contexts = rowArr.map((r) => ({
      title:     r.ai_title ?? "",
      summary:   r.ai_summary ?? "",
      sourceUrl: r.source_url ?? undefined,
    }));

    const answer = contexts.length
      ? await ragAnswer(query, contexts)
      : "目前沒有足夠的筆記內容可以回答這個問題。";

    res.json({ answer, sources });
  } catch (err) {
    next(err);
  }
});

router.get("/search/keyword", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const q     = req.query["q"] ? String(req.query["q"]) : undefined;
    const page  = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));

    if (!q) {
      throw new AppError("q is required", ERROR_CODES.MISSING_FIELD, 400);
    }

    const pattern = `%${q}%`;
    const conditions = and(
      eq(notesTable.userId, userId),
      or(
        ilike(notesTable.aiTitle,    pattern),
        ilike(notesTable.aiSummary,  pattern),
        ilike(notesTable.sourceText, pattern),
        ilike(notesTable.userNote,   pattern),
      ),
    );

    const [notes, totalResult] = await Promise.all([
      db
        .select({
          id:          notesTable.id,
          aiTitle:     notesTable.aiTitle,
          aiSummary:   notesTable.aiSummary,
          tags:        notesTable.tags,
          sourceUrl:   notesTable.sourceUrl,
          sourceTitle: notesTable.sourceTitle,
          noteType:    notesTable.noteType,
          aiStatus:    notesTable.aiStatus,
          createdAt:   notesTable.createdAt,
        })
        .from(notesTable)
        .where(conditions)
        .orderBy(desc(notesTable.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notesTable)
        .where(conditions),
    ]);

    res.json({ notes, total: totalResult[0]?.count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

export default router;
