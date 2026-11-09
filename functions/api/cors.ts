const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "https://www.recipe-forge.com",
  "https://recipe-forge.com",
];

// Every Vercel domain for this project: the bare default domain, its
// per-team-slug alias, and every per-branch/per-deployment preview, e.g.
// culinary-vault-scribe.vercel.app
// culinary-vault-scribe-ellesteiner-5252s-projects.vercel.app
// culinary-vault-scribe-git-foo-ellesteiner-5252s-projects.vercel.app
const VERCEL_PREVIEW = /^https:\/\/culinary-vault-scribe(-[a-z0-9-]+)?\.vercel\.app$/;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW.test(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
}
