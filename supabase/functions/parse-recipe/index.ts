// Parses arbitrary pasted recipe text (YAML, Markdown, plain text, ChatGPT output, blog text)
// into the Culinary Vault Scribe recipe schema using Lovable AI.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You convert messy recipe text into a strict JSON object.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();

    if (typeof text !== "string" || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Please paste a recipe (at least a few lines)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 30000) {
      return new Response(JSON.stringify({ error: "Recipe text is too long (30k char max)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Parse this recipe:\n\n${text}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch (e) {
      console.error("Failed to parse AI JSON", e, raw);
      return new Response(JSON.stringify({ error: "Could not parse recipe. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize -> flatten to form-friendly strings while preserving sections.
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
    if (description) {
      notes = notes ? `${description}\n\n${notes}` : description;
    }

    const result = {
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
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-recipe error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
