# Supabase → Neon migration

Status as of this doc: **built, tested, not cut over.** All work is on branch
`migration/neon`. `main` / production still runs on Supabase. Nothing has been
merged, and Supabase has not been written to — only read via a local backup.

## Why

Moving off Supabase onto Neon (Lakebase Postgres + Neon Auth + Neon Functions).
No functional complaints with Supabase prompted this — it was a deliberate
infra move.

## Architecture decision

Chose **Option B**: a server API layer sits between the browser and Postgres,
rather than Neon's Data API (PostgREST-compatible) with browser-facing RLS.
Authorization that used to live in Supabase RLS policies now lives in code,
in the API layer.

- **Postgres**: new Neon project `culinary-vault-scribe` (`us-east-1`,
  project id `broad-tree-49247259`). `public` schema only — RLS policies,
  grants, and the `auth` schema were not carried over.
- **Auth**: Neon Auth (Managed Better Auth) replaces Supabase Auth.
- **API layer**: one Neon Function running a Hono app (`functions/api/`),
  replacing every direct `supabase-js` table/RPC call from the frontend and
  all 5 Supabase edge functions.
- **Storage**: not used by this app (confirmed — no `supabase.storage` calls
  anywhere), so nothing to migrate there.

## What moved where

| Old (Supabase) | New (Neon) |
|---|---|
| Postgres tables (`profiles`, `recipes`, `tags`, `recipe_tags`, `recipe_comments`, `recipe_likes`, `user_roles`) | Same tables, same data, `neon/schema/001_init.sql` |
| RLS policies (ownership/admin checks) | Checked in route code — see `functions/api/routes/*.ts` |
| `auth.users` + Supabase Auth | Neon Auth (`neon_auth` schema on the same Postgres branch) |
| `handle_new_user()` trigger | `ensureProfile()` in `functions/api/auth.ts` — see relink logic below |
| `has_role()` SQL function (used inside RLS) | `isAdmin()` in `functions/api/auth.ts`, called directly from route code |
| Edge function `toggle-like` | `POST /likes/toggle` |
| Edge function `ai-sous-chef` | `POST /ai/sous-chef` |
| Edge function `parse-recipe` | `POST /ai/parse-recipe` |
| Edge function `suggest-tags` | `POST /ai/suggest-tags` |
| Edge function `scrape-recipe` | `POST /scrape-recipe` |
| `supabase-js` client (`src/integrations/supabase/`) | `@neon/auth` client + `apiFetch` (`src/integrations/neon/client.ts`) |

## Identity relink (the 7 users)

Only `ellesteiner@gmail.com` was proactively recreated in Neon Auth. The
other 6 users' rows (recipes, comments, likes, profile) were **left as-is**,
still carrying their old Supabase user ids.

`ensureProfile(userId, email)` (`functions/api/auth.ts`) runs on every
authenticated request and handles three cases:

1. A profile already exists for this Neon Auth user id → return it (normal
   case, after the first run).
2. A profile exists for this **email** under a different (old, orphaned)
   user id → reassign that profile and every row referencing the old id
   (`recipes`, `recipe_comments`, `recipe_likes`, `user_roles`) to the new
   id, in one transaction, then return it. This is how Elle's account was
   relinked — verified by direct SQL query, not just the API response: all
   42 recipes, 11 comments, 1 like, and the admin role moved, zero left
   under the old id. It's also exactly what will happen automatically for
   any of the other 6 users the first time they sign up again.
3. No profile for this email at all → create a new one (brand-new user,
   same as the old `handle_new_user()` trigger did).

## Verified row counts (Supabase → Neon)

| Table | Count |
|---|---|
| recipes | 46 |
| tags | 32 |
| recipe_tags | 90 |
| recipe_comments | 11 |
| recipe_likes | 3 |
| profiles | 7 |
| user_roles | 1 |
| auth users | 7 |

Backup (schema + data + `auth.users`, for rollback reference) lives at
`~/Backups/culinary-vault-scribe-supabase/` on this machine — **not**
committed to the repo, not shared anywhere. It's a one-time snapshot from
the day of the migration, not kept in sync with Supabase afterward.

## AI functions — Lovable check

Flagged specifically because the app was originally scaffolded via Lovable:
**none of the AI functions actually depend on Lovable's AI Gateway.**
`ai-sous-chef`, `parse-recipe`, and `suggest-tags` all call `api.openai.com`
directly using `OPENAI_API_KEY` — the "using Lovable AI Gateway" comments in
the original source were stale leftover text, not real code paths.
`scrape-recipe` doesn't call any AI provider. `OPENAI_API_KEY` is set as a
Neon Function secret (`neon.ts`, `functions.api.env`), not in Vercel — the
frontend never touches it directly.

## Gotchas hit during the build (so the next person doesn't re-derive these)

- **Supabase pooler host**: this project's session pooler is
  `aws-1-us-west-2.pooler.supabase.com`, not `aws-0-...` — the wrong one
  fails with `tenant/user not found`, not a clear "wrong host" error.
- **`supabase db dump` needs Docker**, which wasn't installed. Used
  `pg_dump`/`psql` directly instead (installed via `brew install libpq`,
  binaries at `/opt/homebrew/opt/libpq/bin/`).
- **`@neon/auth`'s React adapter `.token()` returns the JWT at
  `data.session.token`**, not `data.token` as the generic Better Auth docs
  describe. Got this wrong on the first pass — it silently 401'd every
  authenticated request (session looked fine, API calls didn't) until
  caught. See `getToken()` in `src/integrations/neon/client.ts`.
- **Better Auth's `changePassword` requires `currentPassword`.** Supabase's
  `auth.updateUser({ password })` didn't. `ChangePasswordModal.tsx` now has
  a Current Password field that didn't exist before.
- **`scrape-recipe`'s bot-block detection was too narrow.** The original
  (and first ported) version only recognized HTTP 403/429/503 as "this site
  blocks bots" and showed a generic, unhelpful error for everything else.
  Live testing turned up a real case — Dotdash Meredith's sites (Allrecipes,
  Simply Recipes) return 402 for this scraper's cloud egress IP, not 403.
  Broadened the recognized set to 401/402/403/406/420/429/451/503. The
  underlying block itself isn't fixable from here — these sites' WAFs
  reject cloud/datacenter IPs regardless of which platform hosts the
  scraper (this was already true on the old Supabase/Deno function too,
  which is why it had this handling in the first place).
- **`bun.lock` removed.** Confirmed via Vercel's project settings
  (`npm install --legacy-peer-deps` is the actual install command already
  in use there) that npm, not bun, is the real standard for this project —
  `bun.lock` was dead weight left over from scaffolding.
- **Neon CLI version matters**: the structured `env: { KEY: { value, required } }`
  syntax in `neon.ts` needs `neon` CLI ≥ 9.2.0 and `@neon/config` ≥ 1.13.0.
  An older CLI fails with a confusing "expected string, received object"
  error rather than a version complaint.

## CORS / trusted domains

`functions/api/cors.ts` allowlists exact origins plus a regex for this
project's Vercel preview URLs (`culinary-vault-scribe[-...].vercel.app`,
covering both the bare default domain and every per-branch/per-deployment
variant). Neon Auth's trusted-domain list is kept in sync with the same set
via `neon neon-auth domain add/list/delete`.

## Not done yet (cutover)

- `main` has not been merged into; production (`www.recipe-forge.com`) still
  runs on Supabase.
- Vercel's **Production** environment still has only the old
  `VITE_SUPABASE_*` vars. The new `VITE_NEON_AUTH_URL` / `VITE_API_BASE_URL`
  are only set for the `migration/neon` branch's Preview environment so far.
- Supabase project `qljhioestruhoppudmdh` has not been touched beyond the
  read-only backup — no decommissioning, no env var changes there.
- Once cutover happens: tag the current production commit first, confirm
  the CORS/trusted-domain allowlist still matches Vercel's real domains,
  merge, watch the deploy, verify live, *then* flip Supabase env vars and
  decommission that project as a separate later step — don't do it in the
  same pass as the merge.
