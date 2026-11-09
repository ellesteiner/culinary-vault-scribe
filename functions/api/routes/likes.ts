import { Hono } from "hono";
import { pool } from "../db";
import { requireAuth, type AuthVars } from "../auth";

export const likes = new Hono<{ Variables: AuthVars }>();

likes.get("/likes/counts", async (c) => {
  const { rows } = await pool.query<{ recipe_id: string; like_count: string }>(
    `SELECT * FROM public.get_recipe_like_counts()`,
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.recipe_id] = Number(row.like_count);
  return c.json(counts);
});

likes.get("/likes/mine", requireAuth, async (c) => {
  const { rows } = await pool.query<{ recipe_id: string }>(
    `SELECT recipe_id FROM public.recipe_likes WHERE user_id = $1`,
    [c.get("userId")],
  );
  const mine: Record<string, boolean> = {};
  for (const row of rows) mine[row.recipe_id] = true;
  return c.json(mine);
});

likes.post("/likes/toggle", requireAuth, async (c) => {
  const { recipe_id } = await c.req.json<{ recipe_id: string }>();
  if (!recipe_id) return c.json({ error: "recipe_id required" }, 400);
  const userId = c.get("userId");

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM public.recipe_likes WHERE recipe_id = $1 AND user_id = $2`,
    [recipe_id, userId],
  );
  if (existing.rows[0]) {
    await pool.query(`DELETE FROM public.recipe_likes WHERE id = $1`, [existing.rows[0].id]);
    return c.json({ liked: false });
  }
  await pool.query(`INSERT INTO public.recipe_likes (recipe_id, user_id) VALUES ($1, $2)`, [recipe_id, userId]);
  return c.json({ liked: true });
});
