import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tagsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/tags", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const tags = await db
      .select({ name: tagsTable.name, useCount: tagsTable.useCount })
      .from(tagsTable)
      .where(eq(tagsTable.userId, userId))
      .orderBy(desc(tagsTable.useCount));

    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

export default router;
