import { Hono } from "hono";
import { requireAuth, ensureProfile, isAdmin, type AuthVars } from "./auth";
import { corsHeaders, isAllowedOrigin } from "./cors";
import { recipes } from "./routes/recipes";
import { tags } from "./routes/tags";
import { comments } from "./routes/comments";
import { likes } from "./routes/likes";
import { admin } from "./routes/admin";
import { ai } from "./routes/ai";
import { scrape } from "./routes/scrape";

const app = new Hono<{ Variables: AuthVars }>();

app.use("*", async (c, next) => {
  const origin = c.req.header("origin") ?? null;
  const headers = corsHeaders(origin);
  for (const [k, v] of Object.entries(headers)) c.header(k, v);
  c.header("Cache-Control", "no-store");
  if (c.req.method === "OPTIONS") {
    return c.body(null, isAllowedOrigin(origin) ? 204 : 403);
  }
  await next();
});

app.get("/whoami", requireAuth, async (c) => {
  const userId = c.get("userId");
  const email = c.get("email");
  const profile = await ensureProfile(userId, email);
  const adminFlag = await isAdmin(userId);
  return c.json({ userId, email, profile, isAdmin: adminFlag });
});

app.route("/recipes", recipes);
app.route("/tags", tags);
app.route("/", comments);
app.route("/", likes);
app.route("/admin", admin);
app.route("/ai", ai);
app.route("/", scrape);

export default app;
