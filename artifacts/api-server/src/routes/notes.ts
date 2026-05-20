import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable, tagsTable } from "@workspace/db/schema";
import { eq, and, desc, asc, sql, ilike, gte, lte, arrayContains, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { summarizeText, embedText, ocrImage } from "../lib/ai.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

async function upsertTags(userId: string, tags: string[]): Promise<void> {
  if (!tags.length) return;
  await db
    .insert(tagsTable)
    .values(tags.map((name) => ({ userId, name, useCount: 1 })))
    .onConflictDoUpdate({
      target: [tagsTable.userId, tagsTable.name],
      set: { useCount: sql`${tagsTable.useCount} + 1` },
    });
}

async function triggerAiProcessing(
  noteId: string,
  sourceText: string,
  ctx?: { sourceTitle?: string | null; sourceUrl?: string | null },
): Promise<void> {
  try {
    const { title, summary, tags } = await summarizeText(sourceText, ctx);

    await db
      .update(notesTable)
      .set({ aiTitle: title, aiSummary: summary, tags, aiStatus: "done", updatedAt: new Date() })
      .where(eq(notesTable.id, noteId));

    const [note] = await db
      .select({ userId: notesTable.userId })
      .from(notesTable)
      .where(eq(notesTable.id, noteId))
      .limit(1);
    if (note) await upsertTags(note.userId, tags);

    try {
      const vector = await embedText(`${title}\n${summary}\n${sourceText.slice(0, 2000)}`);
      if (vector.length) {
        const vectorStr = `[${vector.join(",")}]`;
        await db.execute(
          sql`UPDATE notes SET embedding = ${vectorStr}::vector WHERE id = ${noteId}`,
        );
      }
    } catch (embErr) {
      logger.warn({ err: embErr, noteId }, "Embedding failed, note still marked done");
    }
  } catch (err) {
    logger.error({ err, noteId }, "AI processing failed");
    await db
      .update(notesTable)
      .set({ aiStatus: "failed", updatedAt: new Date() })
      .where(eq(notesTable.id, noteId));
  }
}

async function triggerOcrAndAiProcessing(noteId: string, imageBase64: string): Promise<void> {
  try {
    const ocrText = await ocrImage(imageBase64);

    await db
      .update(notesTable)
      .set({ ocrText, updatedAt: new Date() })
      .where(eq(notesTable.id, noteId));

    await triggerAiProcessing(noteId, ocrText);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err), noteId }, "OCR processing failed");
    await db
      .update(notesTable)
      .set({ aiStatus: "failed", updatedAt: new Date() })
      .where(eq(notesTable.id, noteId));
  }
}

async function findRelatedNotes(
  noteId: string,
  userId: string,
  topK = 5,
): Promise<Array<{ id: string; aiTitle: string | null; aiSummary: string | null }>> {
  try {
    const [note] = await db
      .select({ embedding: notesTable.embedding })
      .from(notesTable)
      .where(eq(notesTable.id, noteId))
      .limit(1);

    if (!note?.embedding?.length) return [];

    const vectorStr = `[${note.embedding.join(",")}]`;
    const rows = await db.execute<{ id: string; ai_title: string | null; ai_summary: string | null }>(
      sql`
        SELECT id, ai_title, ai_summary
        FROM notes
        WHERE user_id = ${userId}
          AND id != ${noteId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${topK}
      `,
    );

    return (rows as unknown as Array<{ id: string; ai_title: string | null; ai_summary: string | null }>).map((r) => ({
      id: r.id,
      aiTitle: r.ai_title,
      aiSummary: r.ai_summary,
    }));
  } catch {
    return [];
  }
}

router.get("/notes", requireAuth, async (req, res, next) => {
  try {
    const userId  = req.user!.id;
    const page    = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit   = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
    const sort    = String(req.query["sort"] ?? "created_at_desc");
    const tagsQ   = req.query["tags"] ? String(req.query["tags"]).split(",").filter(Boolean) : undefined;
    const domain  = req.query["domain"]   ? String(req.query["domain"])   : undefined;
    const dateFrom = req.query["dateFrom"] ? String(req.query["dateFrom"]) : undefined;
    const dateTo   = req.query["dateTo"]   ? String(req.query["dateTo"])   : undefined;

    const typeFilter = req.query["type"] ? String(req.query["type"]) : "notes";

    const conditions = [eq(notesTable.userId, userId)];
    if (typeFilter === "bookmarks") {
      conditions.push(eq(notesTable.noteType, "bookmark"));
    } else {
      // 預設時間軸只顯示 text / image，排除 bookmark
      conditions.push(sql`${notesTable.noteType} != 'bookmark'`);
    }
    if (tagsQ?.length) conditions.push(arrayContains(notesTable.tags, tagsQ));
    if (domain)   conditions.push(sql`${notesTable.sourceUrl} ILIKE ${"%" + domain + "%"}`);
    if (dateFrom) conditions.push(gte(notesTable.createdAt, new Date(dateFrom)));
    if (dateTo)   conditions.push(lte(notesTable.createdAt, new Date(dateTo)));

    const orderBy = sort === "created_at_asc" ? asc(notesTable.createdAt) : desc(notesTable.createdAt);

    const [notes, totalResult] = await Promise.all([
      db
        .select({
          id:          notesTable.id,
          aiTitle:     notesTable.aiTitle,
          aiSummary:   notesTable.aiSummary,
          userNote:    notesTable.userNote,
          tags:        notesTable.tags,
          sourceUrl:   notesTable.sourceUrl,
          sourceTitle: notesTable.sourceTitle,
          noteType:    notesTable.noteType,
          aiStatus:    notesTable.aiStatus,
          createdAt:   notesTable.createdAt,
        })
        .from(notesTable)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notesTable)
        .where(and(...conditions)),
    ]);

    res.json({ notes, total: totalResult[0]?.count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

router.post("/notes/text", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { sourceUrl, sourceTitle, sourceText, userNote, noteType: rawNoteType } = req.body as {
      sourceUrl?: string;
      sourceTitle?: string;
      sourceText?: string;
      userNote?: string;
      noteType?: string;
    };

    if (!sourceText) {
      throw new AppError("sourceText is required", ERROR_CODES.MISSING_FIELD, 400);
    }

    const noteType = rawNoteType === "page" ? "page" : "text";

    const [note] = await db
      .insert(notesTable)
      .values({ userId, sourceUrl, sourceTitle, sourceText, userNote, noteType, aiStatus: "pending" })
      .returning({ id: notesTable.id, aiStatus: notesTable.aiStatus });

    req.log.info({ noteId: note!.id }, "Text note created");
    void triggerAiProcessing(note!.id, sourceText, { sourceTitle, sourceUrl });

    res.status(201).json({ noteId: note!.id, aiStatus: note!.aiStatus });
  } catch (err) {
    next(err);
  }
});

router.post("/notes/image", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { sourceUrl, sourceTitle, imageBase64, userNote } = req.body as {
      sourceUrl?: string;
      sourceTitle?: string;
      imageBase64?: string;
      userNote?: string;
    };

    if (!imageBase64) {
      throw new AppError("imageBase64 is required", ERROR_CODES.MISSING_FIELD, 400);
    }

    const [note] = await db
      .insert(notesTable)
      .values({ userId, sourceUrl, sourceTitle, userNote, noteType: "image", aiStatus: "pending" })
      .returning({ id: notesTable.id, aiStatus: notesTable.aiStatus });

    req.log.info({ noteId: note!.id }, "Image note created");
    void triggerOcrAndAiProcessing(note!.id, imageBase64);

    res.status(201).json({ noteId: note!.id, aiStatus: note!.aiStatus });
  } catch (err) {
    next(err);
  }
});

router.post("/notes/bookmark", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { sourceUrl, sourceTitle, userNote } = req.body as {
      sourceUrl?: string;
      sourceTitle?: string;
      userNote?: string;
    };

    if (!sourceUrl) {
      throw new AppError("sourceUrl is required", ERROR_CODES.MISSING_FIELD, 400);
    }

    const [note] = await db
      .insert(notesTable)
      .values({
        userId,
        sourceUrl,
        sourceTitle,
        sourceText: sourceTitle ?? sourceUrl,
        userNote,
        noteType: "bookmark",
        aiStatus: "done",
        aiTitle: sourceTitle ?? sourceUrl,
        aiSummary: null,
      })
      .returning({ id: notesTable.id, aiStatus: notesTable.aiStatus });

    req.log.info({ noteId: note!.id }, "Bookmark created");
    res.status(201).json({ noteId: note!.id, aiStatus: "done" });
  } catch (err) {
    next(err);
  }
});

router.get("/notes/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params["id"]);

    const [note] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
      .limit(1);

    if (!note) {
      throw new AppError("Note not found", ERROR_CODES.NOT_FOUND, 404);
    }

    // Fetch highlights separately via raw SQL (jsonb, not in Drizzle schema)
    const hlRows = await db.execute<{ highlights: unknown }>(
      sql`SELECT highlights FROM notes WHERE id = ${id} AND user_id = ${userId} LIMIT 1`,
    );
    const highlights = (hlRows as unknown as Array<{ highlights: unknown }>)[0]?.highlights ?? [];

    const relatedNotes = await findRelatedNotes(id, userId);

    res.json({ ...note, highlights, relatedNotes });
  } catch (err) {
    next(err);
  }
});

router.patch("/notes/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params["id"]);
    const { aiTitle, aiSummary, userNote, tags, highlights } = req.body as {
      aiTitle?: string;
      aiSummary?: string;
      userNote?: string;
      tags?: string[];
      highlights?: Array<{ start: number; end: number; color: string }>;
    };

    const [existing] = await db
      .select({ id: notesTable.id, sourceText: notesTable.sourceText })
      .from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new AppError("Note not found", ERROR_CODES.NOT_FOUND, 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (aiTitle !== undefined)   updates["aiTitle"]   = aiTitle;
    if (aiSummary !== undefined) updates["aiSummary"] = aiSummary;
    if (userNote !== undefined)  updates["userNote"]  = userNote;
    if (tags !== undefined) {
      updates["tags"] = tags;
      await upsertTags(userId, tags);
    }

    await db.update(notesTable).set(updates).where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)));

    // JSONB columns need explicit cast to avoid driver serialisation issues
    if (highlights !== undefined) {
      await db.execute(
        sql`UPDATE notes SET highlights = ${JSON.stringify(highlights)}::jsonb WHERE id = ${id} AND user_id = ${userId}`,
      );
    }

    const reembedding = !!(aiTitle !== undefined || aiSummary !== undefined);
    if (reembedding && existing.sourceText) {
      void (async () => {
        try {
          const text = `${aiTitle ?? ""}\n${aiSummary ?? ""}\n${existing.sourceText!.slice(0, 2000)}`;
          const vector = await embedText(text);
          if (vector.length) {
            const vectorStr = `[${vector.join(",")}]`;
            await db.execute(sql`UPDATE notes SET embedding = ${vectorStr}::vector WHERE id = ${id}`);
          }
        } catch (err) {
          logger.warn({ err, noteId: id }, "Re-embedding failed");
        }
      })();
    }

    res.json({ noteId: id, reembedding });
  } catch (err) {
    next(err);
  }
});

router.post("/notes/:id/retry-ai", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params["id"]);

    const [note] = await db
      .select({ id: notesTable.id, sourceText: notesTable.sourceText, ocrText: notesTable.ocrText, aiStatus: notesTable.aiStatus })
      .from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
      .limit(1);

    if (!note) throw new AppError("Note not found", ERROR_CODES.NOT_FOUND, 404);
    if (note.aiStatus === "done") throw new AppError("Already processed", ERROR_CODES.INVALID_INPUT, 400);

    const text = note.sourceText ?? note.ocrText;
    if (!text) throw new AppError("No text to process", ERROR_CODES.MISSING_FIELD, 400);

    await db.update(notesTable).set({ aiStatus: "pending", updatedAt: new Date() }).where(eq(notesTable.id, id));
    void triggerAiProcessing(id, text);

    res.json({ noteId: id, aiStatus: "pending" });
  } catch (err) {
    next(err);
  }
});

router.delete("/notes/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params["id"]);

    const result = await db
      .delete(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
      .returning({ id: notesTable.id });

    if (!result.length) {
      throw new AppError("Note not found", ERROR_CODES.NOT_FOUND, 404);
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
