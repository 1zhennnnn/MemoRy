import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable, dailyReportsTable } from "@workspace/db/schema";
import { eq, and, desc, gte, lte, sql, notInArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { generateDailyReport, embedText } from "../lib/ai.js";

const router: IRouter = Router();

type RelatedNote = {
  id: string; aiTitle: string | null; aiSummary: string | null; userNote: string | null;
  aiStatus: string; tags: string[]; sourceUrl: string | null; sourceTitle: string | null;
  noteType: string; createdAt: string;
};
// Cache invalidated by comparing MAX(updated_at) of user's done notes — no stale TTL needed
const relatedNotesCache = new Map<string, { notes: RelatedNote[]; notesVersion: string }>();

router.get("/reports", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const page  = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query["limit"] ?? "10"), 10)));

    const [reports, totalResult] = await Promise.all([
      db
        .select()
        .from(dailyReportsTable)
        .where(eq(dailyReportsTable.userId, userId))
        .orderBy(desc(dailyReportsTable.reportDate))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dailyReportsTable)
        .where(eq(dailyReportsTable.userId, userId)),
    ]);

    res.json({ reports, total: totalResult[0]?.count ?? 0 });
  } catch (err) {
    next(err);
  }
});

router.post("/reports/generate", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { date: bodyDate } = req.body as { date?: string };
    const date = bodyDate ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd   = new Date(`${date}T23:59:59Z`);

    const dayNotes = await db
      .select({
        id:        notesTable.id,
        aiTitle:   notesTable.aiTitle,
        aiSummary: notesTable.aiSummary,
        tags:      notesTable.tags,
      })
      .from(notesTable)
      .where(
        and(
          eq(notesTable.userId, userId),
          eq(notesTable.aiStatus, "done"),
          gte(notesTable.createdAt, dayStart),
          lte(notesTable.createdAt, dayEnd),
        ),
      );

    let keyLearnings: string[] = [];
    let crossDomain: string | null = null;
    let suggestions: string[] = [];

    if (dayNotes.length) {
      const todayNotesMapped = dayNotes.map((n) => ({
        title:   n.aiTitle ?? "",
        summary: n.aiSummary ?? "",
        tags:    n.tags,
      }));

      // RAG: find historically related notes for cross-domain insights
      let relatedNotes: typeof todayNotesMapped = [];
      try {
        type Row = { id: string; ai_title: string | null; ai_summary: string | null; tags: string[] };
        let relatedRows: Row[] = [];

        // Try vector search first
        const queryText = todayNotesMapped.map((n) => `${n.title} ${n.summary}`).join(" ").slice(0, 2000);
        const vector = await embedText(queryText).catch(() => [] as number[]);

        if (vector.length) {
          const vectorStr = `[${vector.join(",")}]`;
          const rows = await db.execute<Row>(
            sql`
              SELECT id, ai_title, ai_summary, tags
              FROM notes
              WHERE user_id = ${userId}
                AND embedding IS NOT NULL
                AND ai_status = 'done'
                AND created_at < ${dayStart}
              ORDER BY (embedding <=> ${vectorStr}::vector) ASC
              LIMIT 5
            `,
          );
          relatedRows = rows as unknown as Row[];
        }

        // Fallback: if no vector results, take most recent historical notes
        if (!relatedRows.length) {
          const rows = await db
            .select({ id: notesTable.id, aiTitle: notesTable.aiTitle, aiSummary: notesTable.aiSummary, tags: notesTable.tags })
            .from(notesTable)
            .where(and(eq(notesTable.userId, userId), eq(notesTable.aiStatus, "done"), lte(notesTable.createdAt, dayStart)))
            .orderBy(desc(notesTable.createdAt))
            .limit(5);
          relatedRows = rows.map((r) => ({ id: r.id, ai_title: r.aiTitle, ai_summary: r.aiSummary, tags: r.tags }));
        }

        relatedNotes = relatedRows.map((r) => ({ title: r.ai_title ?? "", summary: r.ai_summary ?? "", tags: r.tags ?? [] }));
      } catch {
        // Proceed without historical context
      }

      const aiResult = await generateDailyReport(todayNotesMapped, relatedNotes.length ? relatedNotes : undefined);
      keyLearnings = aiResult.keyLearnings;
      crossDomain  = aiResult.crossDomain;
      suggestions  = aiResult.suggestions;
    }

    const noteIds   = dayNotes.map((n) => n.id);
    const noteCount = dayNotes.length;

    const [report] = await db
      .insert(dailyReportsTable)
      .values({ userId, reportDate: date, keyLearnings, crossDomain, suggestions, noteIds, noteCount })
      .onConflictDoUpdate({
        target: [dailyReportsTable.userId, dailyReportsTable.reportDate],
        set: { keyLearnings, crossDomain, suggestions, noteIds, noteCount },
      })
      .returning();

    // Invalidate related-notes cache for this date so next GET re-runs RAG with fresh content
    relatedNotesCache.delete(`${userId}:${date}`);

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

// Fast: returns report without related notes
router.get("/reports/:date", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const date = String(req.params["date"]);

    const [report] = await db
      .select()
      .from(dailyReportsTable)
      .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.reportDate, date)))
      .limit(1);

    if (!report) {
      throw new AppError("Report not found", ERROR_CODES.NOT_FOUND, 404);
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
});

// Slow (RAG): returns related notes with version-based cache invalidation
router.get("/reports/:date/related", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const date = String(req.params["date"]);

    // Get report for noteIds exclusion + report content for embedding query
    const [report] = await db
      .select()
      .from(dailyReportsTable)
      .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.reportDate, date)))
      .limit(1);

    if (!report) {
      return res.json({ relatedNotes: [] });
    }

    // Fetch the version key: MAX(updated_at) of user's done notes (fast indexed query)
    const versionRows = await db.execute<{ version: string | null }>(
      sql`SELECT MAX(updated_at)::text AS version FROM notes WHERE user_id = ${userId} AND ai_status = 'done'`,
    );
    const notesVersion = String((versionRows as unknown as Array<{ version: string | null }>)[0]?.version ?? '');

    const cacheKey = `${userId}:${date}`;
    const cached = relatedNotesCache.get(cacheKey);
    if (cached && cached.notesVersion === notesVersion && notesVersion) {
      return res.json({ relatedNotes: cached.notes });
    }

    const reportNoteIds: string[] = report.noteIds ?? [];
    const noteFields = {
      id: notesTable.id, aiTitle: notesTable.aiTitle, aiSummary: notesTable.aiSummary,
      userNote: notesTable.userNote, aiStatus: notesTable.aiStatus, tags: notesTable.tags,
      sourceUrl: notesTable.sourceUrl, sourceTitle: notesTable.sourceTitle,
      noteType: notesTable.noteType, createdAt: notesTable.createdAt,
    };

    const excludeIds = reportNoteIds.length
      ? sql`AND id != ALL(ARRAY[${sql.join(reportNoteIds.map((id) => sql`${id}`), sql`, `)}]::uuid[])`
      : sql``;

    let relatedNotes: RelatedNote[] = [];

    // Try RAG
    try {
      const queryText = [
        ...(report.keyLearnings ?? []),
        report.crossDomain ?? "",
      ].join(" ").trim().slice(0, 2000);

      if (queryText) {
        const vector = await embedText(queryText).catch(() => [] as number[]);
        if (vector.length) {
          const vectorStr = `[${vector.join(",")}]`;
          type RagRow = {
            id: string; ai_title: string | null; ai_summary: string | null; user_note: string | null;
            ai_status: string; tags: string[]; source_url: string | null; source_title: string | null;
            note_type: string; created_at: string | Date;
          };
          const rows = await db.execute<RagRow>(
            sql`
              SELECT id, ai_title, ai_summary, user_note, ai_status, tags,
                     source_url, source_title, note_type, created_at
              FROM notes
              WHERE user_id = ${userId}
                AND embedding IS NOT NULL
                AND ai_status = 'done'
                ${excludeIds}
              ORDER BY (embedding <=> ${vectorStr}::vector) ASC
              LIMIT 5
            `,
          );
          relatedNotes = (rows as unknown as RagRow[]).map((r) => ({
            id: r.id, aiTitle: r.ai_title, aiSummary: r.ai_summary, userNote: r.user_note,
            aiStatus: r.ai_status, tags: (r.tags ?? []) as string[],
            sourceUrl: r.source_url, sourceTitle: r.source_title, noteType: r.note_type,
            createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
          }));
        }
      }
    } catch { /* fall through */ }

    // Fallback: most recent notes
    if (!relatedNotes.length) {
      try {
        const baseWhere = reportNoteIds.length
          ? and(eq(notesTable.userId, userId), eq(notesTable.aiStatus, "done"), notInArray(notesTable.id, reportNoteIds))
          : and(eq(notesTable.userId, userId), eq(notesTable.aiStatus, "done"));
        const rows = await db.select(noteFields).from(notesTable).where(baseWhere).orderBy(desc(notesTable.createdAt)).limit(5);
        relatedNotes = rows.map((r) => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) }));
      } catch { /* no related notes */ }
    }

    relatedNotesCache.set(cacheKey, { notes: relatedNotes, notesVersion });
    res.json({ relatedNotes });
  } catch (err) {
    next(err);
  }
});

router.delete("/reports/:date", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const date = String(req.params["date"]);

    const result = await db
      .delete(dailyReportsTable)
      .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.reportDate, date)))
      .returning({ id: dailyReportsTable.id });

    if (!result.length) {
      throw new AppError("Report not found", ERROR_CODES.NOT_FOUND, 404);
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.patch("/reports/:date/diary", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const date = String(req.params["date"]);
    const { diaryText } = req.body as { diaryText?: string };

    if (diaryText === undefined) {
      throw new AppError("diaryText is required", ERROR_CODES.MISSING_FIELD, 400);
    }

    const result = await db
      .update(dailyReportsTable)
      .set({ diaryText })
      .where(and(eq(dailyReportsTable.userId, userId), eq(dailyReportsTable.reportDate, date)))
      .returning({ id: dailyReportsTable.id });

    if (!result.length) {
      throw new AppError("Report not found", ERROR_CODES.NOT_FOUND, 404);
    }

    res.json({ reportDate: date });
  } catch (err) {
    next(err);
  }
});

export default router;
