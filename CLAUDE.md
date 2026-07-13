# CLAUDE.md

This file gives Claude Code context specific to this repository so future sessions don't have to re-investigate infrastructure that's already been resolved.

## Supabase project

**Production Supabase project ref: `qljhioestruhoppudmdh`** ("MyCookbook Culinary Vault", owned by Elle's own Supabase account/org "Elle's Team", PRO plan). This is confirmed as the project the live site actually talks to (verified via the browser Network tab).

`supabase/config.toml` and the local `.env` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PUBLISHABLE_KEY`) are set to this project. `.env` is gitignored (not tracked) — if it's ever missing locally, pull the values from this project's Supabase dashboard, not from git history.

### The Lovable Cloud mismatch (2026-07 investigation)

This app was originally scaffolded and deployed via Lovable, which auto-provisions its own Supabase backend ("Lovable Cloud"). That original Lovable-managed project ref (`puhtktdustlnvuqyhivt`) is **not** the one production actually runs on — it's a separate, Lovable-owned project this account doesn't have access to. If you ever see `puhtktdustlnvuqyhivt` referenced anywhere (old commits, cached configs, etc.), it's stale/irrelevant — the real project is `qljhioestruhoppudmdh`.

**Lesson:** don't assume the Supabase project referenced in `.env`/`config.toml` is correct just because it's what's checked into the repo — a Lovable-scaffolded app's env vars can silently point at Lovable's own backend instead of the developer's actual production database. Confirm against the live site's Network tab and/or `supabase projects list` before trusting local config.

### Migration history baseline (2026-07-12)

`supabase_migrations.schema_migrations` did not exist at all on `qljhioestruhoppudmdh` — none of the 14 local migration files were tracked as applied, even though the schema itself (tables, RLS policies, functions) matched what those migrations describe. This is because the schema was provisioned directly (by Lovable's own deploy pipeline), not by running `supabase db push`.

This was resolved with `supabase migration repair --status applied --linked <all 14 versions>`, which only writes to the tracking table — it does not re-run any SQL. Verified before/after: same table count (7), same RLS policy count (22), same function count (3). If you add new migrations going forward, `supabase db push` should now work correctly against this project without trying to replay the original 14.

Note: a handful of RLS policy names on the live DB don't match the checked-in `.sql` files (e.g. `recipes_insert_own` vs the migration's `"Authenticated users can create recipes"`) — logic is identical, just renamed out-of-band at some point. Cosmetic only, not a bug.

## Codebase cleanup (2026-07, branch `cleanup/codebase-audit`)

A multi-pass cleanup was done on this branch. Summary of what changed:

- **Dead code removed**: `src/components/NavLink.tsx` (unused since the initial template scaffold, never imported), `src/test/example.test.ts` (inert placeholder test).
- **Dependencies removed**: 7 packages with zero imports anywhere (`zod`, `@hookform/resolvers`, `@dnd-kit/core`/`sortable`/`utilities`, `@tailwindcss/typography`, `@testing-library/react`), plus stale lockfiles (`bun.lockb`, `package-lock.json` — this project uses `bun` and `bun.lock` exclusively now).
- **Toast system consolidated**: the app had two toast systems mounted (`sonner` and shadcn's own `Toaster`/`use-toast`), but only `sonner` was ever actually used. Removed the dead shadcn toast plumbing (`hooks/use-toast.ts`, `components/ui/use-toast.ts`, `components/ui/toaster.tsx`, `components/ui/toast.tsx`, the `@radix-ui/react-toast` dependency, and the `<Toaster />` mount in `App.tsx`). `sonner`'s `<Sonner />` remains the only toast system.
- **scrape-recipe error handling improved**: the recipe URL import feature was failing silently against sites with bot-detection (Cloudflare/Akamai-style challenges, e.g. seriouseats.com, allrecipes.com) — the edge function now detects 403/429/503 responses and returns a distinct `BLOCKED` error; the frontend shows a specific toast ("This site blocks automated recipe imports. Copy the recipe text from the page and use the Paste Recipe option above instead.") instead of a generic failure message.
- **Consistency pass**: standardized quote style, import path conventions, page component export style, and prop-type naming across a handful of files that had drifted from the rest of the codebase (mostly the original, never-touched template scaffold files).
- **Tag cleanup**: removed two orphaned tags directly from the `qljhioestruhoppudmdh` database (not git-tracked) — `Skincare` (unrelated leftover, 0 recipes) and `side-dish` (duplicate of the actively-used `Side Dish` tag, 0 recipes).

**Deliberately left alone** (not bugs, just noted for future reference):
- ~32 unused shadcn/ui primitive components (`accordion.tsx`, `calendar.tsx`, `carousel.tsx`, etc.) and their backing dependencies (`react-hook-form`, `recharts`, `embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-day-picker`, `react-resizable-panels`) — standard shadcn CLI scaffolding, kept as regenerable design-system infrastructure.
- 4 other orphaned tags (`rice-bowl`, `quick`, `healthy`, `summer-dinner`) — kept for future use per Elle's preference.
