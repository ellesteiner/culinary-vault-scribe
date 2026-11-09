import { Hono } from "hono";
import { pool } from "../db";
import { requireAuth, isAdmin, type AuthVars } from "../auth";

export const recipes = new Hono<{ Variables: AuthVars }>();

type TagRow = { id: string; name: string; created_at: string };
type RecipeRow = Record<string, unknown> & { id: string };

async function attachTags(recipeRows: RecipeRow[]): Promise<(RecipeRow & { tags: TagRow[] })[]> {
  const ids = recipeRows.map((r) => r.id);
  if (ids.length === 0) return recipeRows as (RecipeRow & { tags: TagRow[] })[];
  const { rows } = await pool.query<{ recipe_id: string } & TagRow>(
    `SELECT rt.recipe_id, t.id, t.name, t.created_at
     FROM public.recipe_tags rt
     JOIN public.tags t ON t.id = rt.tag_id
     WHERE rt.recipe_id = ANY($1)`,
    [ids],
  );
  const byRecipe = new Map<string, TagRow[]>();
  for (const row of rows) {
    const list = byRecipe.get(row.recipe_id) ?? [];
    list.push({ id: row.id, name: row.name, created_at: row.created_at });
    byRecipe.set(row.recipe_id, list);
  }
  return recipeRows.map((r) => ({ ...r, tags: byRecipe.get(r.id) ?? [] }));
}

recipes.get("/", async (c) => {
  const { rows } = await pool.query<RecipeRow>(`SELECT * FROM public.recipes ORDER BY created_at DESC`);
  return c.json(await attachTags(rows));
});

recipes.get("/:id", async (c) => {
  const { rows } = await pool.query<RecipeRow>(`SELECT * FROM public.recipes WHERE id = $1`, [c.req.param("id")]);
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const [withTags] = await attachTags(rows);
  return c.json(withTags);
});

type RecipeBody = {
  title: string;
  source_url?: string | null;
  image_url?: string | null;
  ingredients?: string[];
  instructions?: string[];
  notes?: string | null;
  cook_time?: string | null;
  prep_time?: string | null;
  servings?: string | null;
  owner_name?: string | null;
  tagIds?: string[];
};

recipes.post("/", requireAuth, async (c) => {
  const body = await c.req.json<RecipeBody>();
  const userId = c.get("userId");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<RecipeRow>(
      `INSERT INTO public.recipes
         (title, source_url, image_url, ingredients, instructions, notes, cook_time, prep_time, servings, user_id, owner_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        body.title,
        body.source_url || null,
        body.image_url || null,
        JSON.stringify((body.ingredients ?? []).filter(Boolean)),
        JSON.stringify((body.instructions ?? []).filter(Boolean)),
        body.notes || null,
        body.cook_time || null,
        body.prep_time || null,
        body.servings || null,
        userId,
        body.owner_name || null,
      ],
    );
    const recipe = rows[0];
    const tagIds = body.tagIds ?? [];
    for (const tagId of tagIds) {
      await client.query(`INSERT INTO public.recipe_tags (recipe_id, tag_id) VALUES ($1, $2)`, [recipe.id, tagId]);
    }
    await client.query("COMMIT");
    return c.json(recipe, 201);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

async function canModifyRecipe(recipeId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ user_id: string }>(`SELECT user_id FROM public.recipes WHERE id = $1`, [recipeId]);
  if (!rows[0]) return false;
  if (rows[0].user_id === userId) return true;
  return isAdmin(userId);
}

recipes.patch("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!(await canModifyRecipe(id, userId))) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<RecipeBody>();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE public.recipes SET
         title = $1, source_url = $2, image_url = $3, ingredients = $4, instructions = $5,
         notes = $6, cook_time = $7, prep_time = $8, servings = $9, updated_at = now()
       WHERE id = $10`,
      [
        body.title,
        body.source_url || null,
        body.image_url || null,
        JSON.stringify((body.ingredients ?? []).filter(Boolean)),
        JSON.stringify((body.instructions ?? []).filter(Boolean)),
        body.notes || null,
        body.cook_time || null,
        body.prep_time || null,
        body.servings || null,
        id,
      ],
    );
    await client.query(`DELETE FROM public.recipe_tags WHERE recipe_id = $1`, [id]);
    for (const tagId of body.tagIds ?? []) {
      await client.query(`INSERT INTO public.recipe_tags (recipe_id, tag_id) VALUES ($1, $2)`, [id, tagId]);
    }
    await client.query("COMMIT");
    return c.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

recipes.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!(await canModifyRecipe(id, userId))) return c.json({ error: "Forbidden" }, 403);
  await pool.query(`DELETE FROM public.recipes WHERE id = $1`, [id]);
  return c.json({ ok: true });
});
