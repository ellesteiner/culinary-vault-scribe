import { Hono } from "hono";
import { pool } from "../db";
import { requireAuth, type AuthVars } from "../auth";

export const tags = new Hono<{ Variables: AuthVars }>();

tags.get("/", async (c) => {
  const { rows } = await pool.query(`SELECT * FROM public.tags ORDER BY name`);
  return c.json(rows);
});

tags.post("/", requireAuth, async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  const { rows } = await pool.query(`INSERT INTO public.tags (name) VALUES ($1) RETURNING *`, [name]);
  return c.json(rows[0], 201);
});
