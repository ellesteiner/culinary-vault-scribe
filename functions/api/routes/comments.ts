import { Hono } from "hono";
import { pool } from "../db";
import { requireAuth, type AuthVars } from "../auth";

export const comments = new Hono<{ Variables: AuthVars }>();

comments.get("/recipes/:recipeId/comments", async (c) => {
  const { rows } = await pool.query(
    `SELECT * FROM public.recipe_comments WHERE recipe_id = $1 ORDER BY created_at ASC`,
    [c.req.param("recipeId")],
  );
  return c.json(rows);
});

comments.post("/recipes/:recipeId/comments", requireAuth, async (c) => {
  const { content } = await c.req.json<{ content: string }>();
  const { rows } = await pool.query(
    `INSERT INTO public.recipe_comments (recipe_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
    [c.req.param("recipeId"), c.get("userId"), content],
  );
  return c.json(rows[0], 201);
});

async function isCommentOwner(id: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ user_id: string }>(`SELECT user_id FROM public.recipe_comments WHERE id = $1`, [id]);
  return !!rows[0] && rows[0].user_id === userId;
}

comments.patch("/comments/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  if (!(await isCommentOwner(id, c.get("userId")))) return c.json({ error: "Forbidden" }, 403);
  const { content } = await c.req.json<{ content: string }>();
  await pool.query(`UPDATE public.recipe_comments SET content = $1, updated_at = now() WHERE id = $2`, [content, id]);
  return c.json({ ok: true });
});

comments.delete("/comments/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  if (!(await isCommentOwner(id, c.get("userId")))) return c.json({ error: "Forbidden" }, 403);
  await pool.query(`DELETE FROM public.recipe_comments WHERE id = $1`, [id]);
  return c.json({ ok: true });
});
