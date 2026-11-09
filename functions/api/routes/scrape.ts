import { Hono } from "hono";
import { requireAuth, type AuthVars } from "../auth";

export const scrape = new Hono<{ Variables: AuthVars }>();

interface ScrapedRecipe {
  title: string | null;
  image: string | null;
  ingredients: string[];
  instructions: string[];
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
}

// URL validation to prevent SSRF attacks
function validateURL(url: string): { valid: boolean; error?: string } {
  if (url.length > 2048) return { valid: false, error: "URL is too long (max 2048 characters)" };

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return { valid: false, error: "Local addresses are not allowed" };
    }

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (a === 10) return { valid: false, error: "Private network addresses are not allowed" };
      if (a === 172 && b >= 16 && b <= 31) return { valid: false, error: "Private network addresses are not allowed" };
      if (a === 192 && b === 168) return { valid: false, error: "Private network addresses are not allowed" };
      if (a === 169 && b === 254) return { valid: false, error: "Link-local addresses are not allowed" };
      if (a === 0) return { valid: false, error: "Invalid IP address" };
    }

    const blockedHostnames = ["metadata.google.internal", "metadata", "instance-data"];
    if (blockedHostnames.some((blocked) => hostname === blocked || hostname.endsWith("." + blocked))) {
      return { valid: false, error: "Internal hostnames are not allowed" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

scrape.post("/scrape-recipe", requireAuth, async (c) => {
  const body = await c.req.json<{ url?: string }>();
  const url = body?.url;
  if (!url || typeof url !== "string") return c.json({ error: "URL is required and must be a string" }, 400);

  const validation = validateURL(url);
  if (!validation.valid) return c.json({ error: validation.error }, 400);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: controller.signal,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error("Redirects are not allowed");
    }

    if (!response.ok) {
      // Anti-bot/WAF responses vary by vendor and even by request: Cloudflare
      // commonly uses 403/429/503, but a 401/402/406/420/451 "go away, bot"
      // response from the same class of service is just as real (observed
      // live: Dotdash Meredith's WAF returns 402 for this exact scraper from
      // a cloud egress IP, not 403). Treat all of them as the same blocked
      // case rather than only the original narrow 403/429/503 list, which
      // surfaced a generic, unhelpful error for every other block code.
      if ([401, 402, 403, 406, 420, 429, 451, 503].includes(response.status)) {
        return c.json(
          {
            error: "BLOCKED",
            message:
              "This site blocks automated recipe imports. Copy the recipe text from the page and use the Paste Recipe option above instead.",
          },
          502,
        );
      }
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) throw new Error("Response too large");

    const html = await response.text();
    if (html.length > 10 * 1024 * 1024) throw new Error("Response too large");

    return c.json(parseRecipeFromHTML(html));
  } catch (error) {
    console.error("Scraping error:", error);
    return c.json({ error: "Failed to scrape recipe" }, 500);
  } finally {
    clearTimeout(timeoutId);
  }
});

function parseRecipeFromHTML(html: string): ScrapedRecipe {
  const recipe: ScrapedRecipe = {
    title: null,
    image: null,
    ingredients: [],
    instructions: [],
    prepTime: null,
    cookTime: null,
    servings: null,
  };

  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, "").trim();
        const data = JSON.parse(jsonContent);
        const recipes = findRecipeSchema(data);
        if (recipes.length > 0) {
          const recipeData = recipes[0];
          recipe.title = recipeData.name || null;
          recipe.image = extractImage(recipeData.image);
          recipe.ingredients = extractIngredients(recipeData.recipeIngredient);
          recipe.instructions = extractInstructions(recipeData.recipeInstructions);
          recipe.prepTime = formatDuration(recipeData.prepTime);
          recipe.cookTime = formatDuration(recipeData.cookTime || recipeData.totalTime);
          recipe.servings = extractServings(recipeData.recipeYield);
          if (recipe.ingredients.length > 0 || recipe.instructions.length > 0) break;
        }
      } catch {
        continue;
      }
    }
  }

  if (recipe.ingredients.length === 0) {
    const wprmIngredients = extractWPRMIngredients(html);
    if (wprmIngredients.length > 0) recipe.ingredients = wprmIngredients;
  }
  if (recipe.instructions.length === 0) {
    const wprmInstructions = extractWPRMInstructions(html);
    if (wprmInstructions.length > 0) recipe.instructions = wprmInstructions;
  }
  if (recipe.ingredients.length === 0) {
    const htmlIngredients = extractIngredientsFromHTML(html);
    if (htmlIngredients.length > 0) recipe.ingredients = htmlIngredients;
  }
  if (recipe.instructions.length === 0) {
    const htmlInstructions = extractInstructionsFromHTML(html);
    if (htmlInstructions.length > 0) recipe.instructions = htmlInstructions;
  }

  if (!recipe.title) {
    const titleMatch =
      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) recipe.title = decodeHTMLEntities(titleMatch[1]);
  }
  if (!recipe.image) {
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
    if (imageMatch) recipe.image = imageMatch[1];
  }

  return recipe;
}

function extractWPRMIngredients(html: string): string[] {
  const ingredients: string[] = [];
  const ingredientMatches = html.matchAll(/<li[^>]*class="[^"]*wprm-recipe-ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi);
  for (const match of ingredientMatches) {
    const text = stripHTML(match[1]).trim();
    if (text) ingredients.push(decodeHTMLEntities(text));
  }
  return ingredients;
}

function extractWPRMInstructions(html: string): string[] {
  const instructions: string[] = [];
  const instructionMatches = html.matchAll(/<li[^>]*class="[^"]*wprm-recipe-instruction[^"]*"[^>]*>([\s\S]*?)<\/li>/gi);
  for (const match of instructionMatches) {
    const textMatch = match[1].match(/<span[^>]*class="[^"]*wprm-recipe-instruction-text[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const text = textMatch ? stripHTML(textMatch[1]).trim() : stripHTML(match[1]).trim();
    if (text) instructions.push(decodeHTMLEntities(text));
  }
  return instructions;
}

function extractIngredientsFromHTML(html: string): string[] {
  const ingredients: string[] = [];
  const containerPatterns = [
    /<div[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<ul[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
    /<section[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
  ];
  for (const pattern of containerPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      for (const li of liMatches) {
        const text = stripHTML(li[1]).trim();
        if (text && text.length > 2 && text.length < 500) ingredients.push(decodeHTMLEntities(text));
      }
      if (ingredients.length > 0) break;
    }
    if (ingredients.length > 0) break;
  }
  return ingredients;
}

function extractInstructionsFromHTML(html: string): string[] {
  const instructions: string[] = [];
  const containerPatterns = [
    /<div[^>]*class="[^"]*instructions?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*directions?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*steps?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<ol[^>]*class="[^"]*instructions?[^"]*"[^>]*>([\s\S]*?)<\/ol>/gi,
  ];
  for (const pattern of containerPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      for (const li of liMatches) {
        const text = stripHTML(li[1]).trim();
        if (text && text.length > 5 && text.length < 2000) instructions.push(decodeHTMLEntities(text));
      }
      if (instructions.length === 0) {
        const pMatches = match[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        for (const p of pMatches) {
          const text = stripHTML(p[1]).trim();
          if (text && text.length > 10 && text.length < 2000) instructions.push(decodeHTMLEntities(text));
        }
      }
      if (instructions.length > 0) break;
    }
    if (instructions.length > 0) break;
  }
  return instructions;
}

function findRecipeSchema(data: any): any[] {
  const recipes: any[] = [];
  if (!data) return recipes;
  if (data["@type"] === "Recipe" || (Array.isArray(data["@type"]) && data["@type"].includes("Recipe"))) {
    recipes.push(data);
    return recipes;
  }
  if (data["@graph"] && Array.isArray(data["@graph"])) {
    for (const item of data["@graph"]) {
      if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
        recipes.push(item);
      }
    }
  }
  if (Array.isArray(data)) {
    for (const item of data) recipes.push(...findRecipeSchema(item));
  }
  return recipes;
}

function extractImage(image: any): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return extractImage(image[0]);
  if (image.url) return image.url;
  if (image["@id"]) return image["@id"];
  return null;
}

function extractIngredients(ingredients: any): string[] {
  if (!ingredients) return [];
  if (Array.isArray(ingredients)) {
    return ingredients
      .map((ing: any) => (typeof ing === "string" ? decodeHTMLEntities(ing.trim()) : ""))
      .filter(Boolean);
  }
  return [];
}

function extractInstructions(instructions: any): string[] {
  if (!instructions) return [];
  const result: string[] = [];
  const processInstruction = (item: any) => {
    if (typeof item === "string") {
      result.push(decodeHTMLEntities(stripHTML(item.trim())));
    } else if (item.text) {
      result.push(decodeHTMLEntities(stripHTML(item.text.trim())));
    } else if (item["@type"] === "HowToStep" && item.text) {
      result.push(decodeHTMLEntities(stripHTML(item.text.trim())));
    } else if (item["@type"] === "HowToSection" && item.itemListElement) {
      for (const step of item.itemListElement) processInstruction(step);
    }
  };
  if (Array.isArray(instructions)) {
    for (const instruction of instructions) processInstruction(instruction);
  } else {
    processInstruction(instructions);
  }
  return result.filter(Boolean);
}

function formatDuration(duration: string | null | undefined): string | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (match) {
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""}`;
  }
  return duration.replace("PT", "").toLowerCase();
}

function extractServings(yield_: any): string | null {
  if (!yield_) return null;
  if (typeof yield_ === "string") return yield_;
  if (typeof yield_ === "number") return `${yield_} servings`;
  if (Array.isArray(yield_)) return yield_[0]?.toString() || null;
  return null;
}

function stripHTML(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}
