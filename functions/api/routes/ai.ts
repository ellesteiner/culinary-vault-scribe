import { Hono } from "hono";

export const ai = new Hono();

function aiNotConfigured(c: any) {
  return c.json({ error: "AI not configured" }, 500);
}

async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    }),
  });
}

function cleanJsonContent(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

async function handleAiError(c: any, aiResp: Response) {
  const text = await aiResp.text();
  console.error("AI gateway error", aiResp.status, text);
  if (aiResp.status === 429) return c.json({ error: "Rate limit reached. Please try again shortly." }, 429);
  if (aiResp.status === 402) return c.json({ error: "AI credits exhausted. Please add credits in workspace settings." }, 402);
  return c.json({ error: "AI request failed" }, 500);
}

const SOUS_CHEF_PROMPT = `You are a professional sous chef. Based on the ingredients and dish preferences provided, generate a complete recipe. Return the recipe in this exact JSON format with no markdown, no backticks, no preamble: { title, description, prepTime, cookTime, servings, tags (array of strings), ingredients (array of strings), steps (array of strings) }`;

ai.post("/sous-chef", async (c) => {
  const { ingredients, mood } = await c.req.json<{ ingredients?: string; mood?: string }>();
  if (!ingredients || typeof ingredients !== "string") return c.json({ error: "ingredients required" }, 400);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return aiNotConfigured(c);

  const userMessage = `Ingredients I have: ${ingredients}. What I want to make: ${mood || "anything delicious"}.`;
  const aiResp = await callOpenAI(apiKey, SOUS_CHEF_PROMPT, userMessage);
  if (!aiResp.ok) return handleAiError(c, aiResp);

  const data = await aiResp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  try {
    return c.json({ recipe: JSON.parse(cleanJsonContent(content)) });
  } catch (e) {
    console.error("Parse error", e, content);
    return c.json({ error: "Could not parse recipe" }, 500);
  }
});

const PARSE_RECIPE_PROMPT = `You convert messy recipe text into a strict JSON object.

Input can be YAML, Markdown, plain text, numbered or bulleted lists, ChatGPT output, cookbook excerpts, blog text, or transcribed handwriting. Be resilient: never fail because formatting is imperfect. If a field cannot be determined, return an empty string or empty array for it. Do not invent ingredients or steps.

Return ONLY this JSON shape, no markdown fences, no commentary:
{
  "title": "string",
  "description": "string",
  "prep_time": "string (human readable like '15 mins')",
  "cook_time": "string",
  "total_time": "string",
  "servings": "string (e.g. '4 servings')",
  "ingredients": [
    { "section": "string or empty", "quantity": "string or empty", "unit": "string or empty", "ingredient": "string", "notes": "string or empty" }
  ],
  "instructions": [
    { "section": "string or empty", "step": "string" }
  ],
  "notes": "string",
  "tags": ["string"]
}

Rules:
- Group ingredients/instructions under their section header when present (e.g. "For the sauce:", "## Topping"). Use "" for items with no section.
- Split combined ingredient lines into quantity / unit / ingredient / notes. Preserve fractions ("1/2", "½") as written. "notes" is for things like "chopped", "divided", "to taste".
- Each instruction "step" is one discrete action. Strip leading numbering ("1.", "Step 1:").
- Auto-generate tags when missing. Detect cuisine (e.g. "italian", "mexican", "thai"), cooking method (e.g. "air-fryer", "instant-pot", "slow-cooker", "grill", "no-bake", "one-pot"), dietary categories (e.g. "vegetarian", "vegan", "gluten-free", "dairy-free", "keto"), and meal type (e.g. "breakfast", "dessert", "dinner", "snack"). Use lowercase, hyphenated tag names. 3-8 tags total.
- "description" is a short blurb/intro if one is present in the source; otherwise "".
- "notes" captures tips, variations, storage info, or author notes — not the recipe steps themselves.`;

ai.post("/parse-recipe", async (c) => {
  const { text } = await c.req.json<{ text?: string }>();
  if (typeof text !== "string" || text.trim().length < 10) {
    return c.json({ error: "Please paste a recipe (at least a few lines)." }, 400);
  }
  if (text.length > 30000) return c.json({ error: "Recipe text is too long (30k char max)." }, 400);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return aiNotConfigured(c);

  const aiResp = await callOpenAI(apiKey, PARSE_RECIPE_PROMPT, `Parse this recipe:\n\n${text}`);
  if (!aiResp.ok) return handleAiError(c, aiResp);

  const data = await aiResp.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  let parsed: any = {};
  try {
    parsed = JSON.parse(cleanJsonContent(raw));
  } catch (e) {
    console.error("Failed to parse AI JSON", e, raw);
    return c.json({ error: "Could not parse recipe. Please try again." }, 502);
  }

  const ingredients: string[] = [];
  let currentIngSection = "";
  for (const item of Array.isArray(parsed.ingredients) ? parsed.ingredients : []) {
    const section = (item?.section || "").trim();
    if (section && section !== currentIngSection) {
      currentIngSection = section;
      ingredients.push(`## ${section}`);
    }
    const parts = [item?.quantity, item?.unit, item?.ingredient].map((p) => (p ?? "").toString().trim()).filter(Boolean);
    const notes = (item?.notes ?? "").toString().trim();
    let line = parts.join(" ");
    if (notes) line += line ? `, ${notes}` : notes;
    if (line) ingredients.push(line);
  }

  const instructions: string[] = [];
  let currentInsSection = "";
  for (const item of Array.isArray(parsed.instructions) ? parsed.instructions : []) {
    const section = (item?.section || "").trim();
    if (section && section !== currentInsSection) {
      currentInsSection = section;
      instructions.push(`## ${section}`);
    }
    const step = (item?.step ?? "").toString().trim();
    if (step) instructions.push(step);
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t: any) => typeof t === "string").map((t: string) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8)
    : [];

  const description = (parsed.description ?? "").toString().trim();
  let notes = (parsed.notes ?? "").toString().trim();
  if (description) notes = notes ? `${description}\n\n${notes}` : description;

  return c.json({
    title: (parsed.title ?? "").toString().trim(),
    description,
    prep_time: (parsed.prep_time ?? "").toString().trim(),
    cook_time: (parsed.cook_time ?? "").toString().trim(),
    total_time: (parsed.total_time ?? "").toString().trim(),
    servings: (parsed.servings ?? "").toString().trim(),
    ingredients,
    instructions,
    notes,
    tags,
  });
});

const SUGGEST_TAGS_PROMPT = `You are a culinary cataloging assistant. Given a recipe's title and ingredients, and a list of allowed tag names, choose the 1-5 most relevant tag names from the allowed list. Only return tags that clearly apply. Respond with strict JSON: {"tags": ["tag1", "tag2"]}. No markdown, no commentary.`;

ai.post("/suggest-tags", async (c) => {
  const { title, ingredients, availableTags } = await c.req.json<{
    title?: string;
    ingredients?: string[];
    availableTags?: string[];
  }>();

  if (!Array.isArray(availableTags) || availableTags.length === 0) return c.json({ tags: [] });
  if (!title?.trim() && (!Array.isArray(ingredients) || ingredients.length === 0)) return c.json({ tags: [] });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return aiNotConfigured(c);

  const userMessage = [
    `Recipe title: ${title || "(untitled)"}`,
    `Ingredients:\n${(Array.isArray(ingredients) ? ingredients : []).filter(Boolean).join("\n") || "(none)"}`,
    `Allowed tags: ${availableTags.join(", ")}`,
  ].join("\n\n");

  const aiResp = await callOpenAI(apiKey, SUGGEST_TAGS_PROMPT, userMessage);
  if (!aiResp.ok) return handleAiError(c, aiResp);

  const data = await aiResp.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  let parsed: { tags?: string[] } = {};
  try {
    parsed = JSON.parse(cleanJsonContent(raw));
  } catch {
    parsed = { tags: [] };
  }

  const allowed = new Set(availableTags.map((t) => t.toLowerCase()));
  const suggested = (parsed.tags || [])
    .filter((t) => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => allowed.has(t.toLowerCase()))
    .map((t) => availableTags.find((a) => a.toLowerCase() === t.toLowerCase()) || t)
    .slice(0, 5);

  return c.json({ tags: Array.from(new Set(suggested)) });
});
