// Suggests tags for a recipe based on title + ingredients, picking from the existing tag list.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a culinary cataloging assistant. Given a recipe's title and ingredients, and a list of allowed tag names, choose the 1-5 most relevant tag names from the allowed list. Only return tags that clearly apply. Respond with strict JSON: {"tags": ["tag1", "tag2"]}. No markdown, no commentary.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, ingredients, availableTags } = await req.json();

    if (!Array.isArray(availableTags) || availableTags.length === 0) {
      return new Response(JSON.stringify({ tags: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!title?.trim() && (!Array.isArray(ingredients) || ingredients.length === 0)) {
      return new Response(JSON.stringify({ tags: [] }), {
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

    const userMessage = [
      `Recipe title: ${title || "(untitled)"}`,
      `Ingredients:\n${(Array.isArray(ingredients) ? ingredients : []).filter(Boolean).join("\n") || "(none)"}`,
      `Allowed tags: ${availableTags.join(", ")}`,
    ].join("\n\n");

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
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
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

    let parsed: { tags?: string[] } = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { tags: [] }; }

    const allowed = new Set(availableTags.map((t: string) => t.toLowerCase()));
    const suggested = (parsed.tags || [])
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => allowed.has(t.toLowerCase()))
      // normalize to original casing from availableTags
      .map((t) => availableTags.find((a: string) => a.toLowerCase() === t.toLowerCase()) || t)
      .slice(0, 5);

    return new Response(JSON.stringify({ tags: Array.from(new Set(suggested)) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-tags error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
