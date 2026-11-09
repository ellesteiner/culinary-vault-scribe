import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { pool } from "./db";

const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;

export type AuthVars = {
  userId: string;
  email: string;
};

// Replaces the old Supabase `auth.uid()` + RLS model: every authenticated
// route verifies the bearer JWT itself, then authorizes explicitly in code.
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const { payload } = await jwtVerify(header.slice(7), jwks, { issuer });
    if (!payload.sub || typeof payload.email !== "string") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("userId", payload.sub);
    c.set("email", payload.email);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}

// Same auth check, but a missing/invalid token is not an error — some routes
// (e.g. anonymous recipe likes) behave differently for signed-in vs anonymous
// callers without requiring a session.
export async function optionalAuth(c: Context, next: Next) {
  const header = c.req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    try {
      const { payload } = await jwtVerify(header.slice(7), jwks, { issuer });
      if (payload.sub && typeof payload.email === "string") {
        c.set("userId", payload.sub);
        c.set("email", payload.email);
      }
    } catch {
      // treat as anonymous
    }
  }
  await next();
}

export type Profile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
};

// Replaces the old `handle_new_user()` DB trigger (which fired on
// auth.users insert). Called at the top of any route that needs the
// caller's profile. Three cases:
//   1. Profile already linked to this Neon Auth user id -> return it.
//   2. A profile exists for this email under an old (pre-migration, orphaned
//      Supabase) user id -> relink it and all of that user's rows to the new
//      id, then return it. Covers both Elle's own relink and the automatic
//      relink for any of the other 6 Supabase users if they sign up again.
//   3. No profile for this email at all -> create one (brand-new user).
export async function ensureProfile(userId: string, email: string): Promise<Profile> {
  const existing = await pool.query<Profile>(
    `SELECT id, user_id, email, full_name FROM public.profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orphaned = await client.query<Profile>(
      `SELECT id, user_id, email, full_name FROM public.profiles WHERE email = $1 AND user_id <> $2`,
      [email, userId],
    );

    if (orphaned.rows[0]) {
      const oldUserId = orphaned.rows[0].user_id;
      await client.query(`UPDATE public.profiles SET user_id = $1 WHERE user_id = $2`, [userId, oldUserId]);
      await client.query(`UPDATE public.recipes SET user_id = $1 WHERE user_id = $2`, [userId, oldUserId]);
      await client.query(`UPDATE public.recipe_comments SET user_id = $1 WHERE user_id = $2`, [userId, oldUserId]);
      await client.query(`UPDATE public.recipe_likes SET user_id = $1 WHERE user_id = $2`, [userId, oldUserId]);
      await client.query(`UPDATE public.user_roles SET user_id = $1 WHERE user_id = $2`, [userId, oldUserId]);
      await client.query("COMMIT");
      return { ...orphaned.rows[0], user_id: userId };
    }

    const created = await client.query<Profile>(
      `INSERT INTO public.profiles (user_id, email, full_name) VALUES ($1, $2, '') RETURNING id, user_id, email, full_name`,
      [userId, email],
    );
    await client.query("COMMIT");
    return created.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  const res = await pool.query(`SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin'`, [userId]);
  return res.rows.length > 0;
}
