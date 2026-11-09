import { Hono } from "hono";
import { pool } from "../db";
import { requireAuth, isAdmin, type AuthVars } from "../auth";

export const admin = new Hono<{ Variables: AuthVars }>();

admin.use("*", requireAuth, async (c, next) => {
  if (!(await isAdmin(c.get("userId")))) return c.json({ error: "Forbidden" }, 403);
  await next();
});

// Mirrors AdminDashboard.tsx's useAdminLikes: time/recipe filters server-side,
// country filter stays client-side (location_data is unpopulated in practice).
admin.get("/likes", async (c) => {
  const since = c.req.query("since"); // ISO timestamp
  const recipeId = c.req.query("recipe_id");

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (since) {
    params.push(since);
    conditions.push(`l.created_at >= $${params.length}`);
  }
  if (recipeId) {
    params.push(recipeId);
    conditions.push(`l.recipe_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT l.id, l.recipe_id, l.ip_address, l.location_data, l.created_at, r.title AS recipe_title
     FROM public.recipe_likes l
     LEFT JOIN public.recipes r ON r.id = l.recipe_id
     ${where}
     ORDER BY l.created_at DESC`,
    params,
  );
  return c.json(
    rows.map((row) => ({
      id: row.id,
      recipe_id: row.recipe_id,
      ip_address: row.ip_address,
      location_data: row.location_data,
      created_at: row.created_at,
      recipes: row.recipe_title ? { title: row.recipe_title } : null,
    })),
  );
});
