import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/export", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const format = String(req.query["format"] ?? "json");

    const notes = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.userId, userId))
      .orderBy(desc(notesTable.createdAt));

    if (format === "markdown") {
      const md = notes
        .map((n) => {
          const lines = [
            `## ${n.aiTitle ?? n.sourceTitle ?? "Untitled"}`,
            "",
            n.aiSummary ? `> ${n.aiSummary}` : "",
            "",
            n.sourceUrl ? `**Source**: ${n.sourceUrl}` : "",
            n.tags.length ? `**Tags**: ${n.tags.join(", ")}` : "",
            `**Date**: ${n.createdAt.toISOString()}`,
            "",
            n.sourceText ?? n.ocrText ?? "",
          ];
          return lines.filter((l) => l !== undefined).join("\n");
        })
        .join("\n\n---\n\n");

      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename="memory-export-${Date.now()}.md"`);
      res.send(md);
      return;
    }

    res.json({ exportedAt: new Date().toISOString(), totalNotes: notes.length, notes });
  } catch (err) {
    next(err);
  }
});

export default router;
