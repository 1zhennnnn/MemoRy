import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable, dailyReportsTable } from "@workspace/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { generateDailyReport } from "../lib/ai.js";

const router: IRouter = Router();

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
      const aiResult = await generateDailyReport(
        dayNotes.map((n) => ({
          title:   n.aiTitle ?? "",
          summary: n.aiSummary ?? "",
          tags:    n.tags,
        })),
      );
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

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

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
