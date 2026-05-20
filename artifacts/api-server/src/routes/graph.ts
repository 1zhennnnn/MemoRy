import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/graph", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    // Fetch most recent 150 done notes
    const notes = await db
      .select({ id: notesTable.id, aiTitle: notesTable.aiTitle, aiSummary: notesTable.aiSummary, tags: notesTable.tags })
      .from(notesTable)
      .where(and(eq(notesTable.userId, userId), eq(notesTable.aiStatus, "done")))
      .orderBy(sql`${notesTable.createdAt} DESC`)
      .limit(150);

    const nodes = notes.map((n) => ({
      id: n.id,
      title: n.aiTitle,
      summary: n.aiSummary,
      tags: n.tags ?? [] as string[],
    }));

    type TagEdge = { source: string; target: string; type: "tag"; weight: number };
    type SemEdge = { source: string; target: string; type: "semantic"; weight: number };

    // Tag edges — SQL array overlap (&&), cap at 250
    const tagRows = await db.execute<{ source_id: string; target_id: string }>(sql`
      SELECT a.id AS source_id, b.id AS target_id
      FROM notes a
      JOIN notes b
        ON b.user_id = a.user_id
       AND b.id > a.id
       AND b.ai_status = 'done'
       AND a.tags && b.tags
      WHERE a.user_id = ${userId}
        AND a.ai_status = 'done'
        AND array_length(a.tags, 1) > 0
      LIMIT 250
    `);

    const edgeSet = new Set<string>();
    const edges: Array<TagEdge | SemEdge> = [];

    for (const r of tagRows as unknown as { source_id: string; target_id: string }[]) {
      const key = `${r.source_id}|${r.target_id}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: r.source_id, target: r.target_id, type: "tag", weight: 1 });
      }
    }

    // Semantic edges — top-3 neighbours per note within distance < 0.55, cap at 350
    try {
      const semRows = await db.execute<{ source_id: string; target_id: string; dist: number }>(sql`
        SELECT a.id AS source_id, b.id AS target_id,
               (a.embedding <=> b.embedding) AS dist
        FROM notes a
        CROSS JOIN LATERAL (
          SELECT id, embedding
          FROM notes inner_n
          WHERE inner_n.user_id = ${userId}
            AND inner_n.id != a.id
            AND inner_n.embedding IS NOT NULL
            AND inner_n.ai_status = 'done'
            AND (a.embedding <=> inner_n.embedding) < 0.55
          ORDER BY a.embedding <=> inner_n.embedding
          LIMIT 3
        ) b
        WHERE a.user_id = ${userId}
          AND a.embedding IS NOT NULL
          AND a.ai_status = 'done'
        LIMIT 350
      `);

      for (const r of semRows as unknown as { source_id: string; target_id: string; dist: number }[]) {
        const [s, t] = [r.source_id, r.target_id].sort();
        const key = `${s}|${t}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            source: r.source_id,
            target: r.target_id,
            type: "semantic",
            weight: Math.round((1 - r.dist) * 100) / 100,
          });
        }
      }
    } catch {
      // No embeddings yet — skip semantic edges silently
    }

    res.json({ nodes, edges });
  } catch (err) {
    next(err);
  }
});

export default router;
