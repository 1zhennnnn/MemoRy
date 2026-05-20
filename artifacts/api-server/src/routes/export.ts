import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";

const router: IRouter = Router();

// Export allows token via query param (download links opened in browser can't set headers)
router.get("/export", async (req, res, next) => {
  try {
    // Prefer Authorization header; fall back to ?token= query param
    const queryToken = String(req.query["token"] ?? "");
    if (queryToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }

    // Delegate to requireAuth inline
    await new Promise<void>((resolve, reject) => {
      requireAuth(req, res, (err) => (err ? reject(err) : resolve()));
    });

    if (!req.user) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED, 401);
    const userId = req.user.id;
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
