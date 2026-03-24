import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
  // Length check
  if (url.length > 2048) {
    return { valid: false, error: 'URL is too long (max 2048 characters)' };
  }

  try {
    const parsed = new URL(url);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { valid: false, error: 'Local addresses are not allowed' };
    }

    // Block private IP ranges (SSRF protection)
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b, c] = ipv4Match.map(Number);
      // 10.x.x.x
      if (a === 10) return { valid: false, error: 'Private network addresses are not allowed' };
      // 172.16.x.x - 172.31.x.x
      if (a === 172 && b >= 16 && b <= 31) return { valid: false, error: 'Private network addresses are not allowed' };
      // 192.168.x.x
      if (a === 192 && b === 168) return { valid: false, error: 'Private network addresses are not allowed' };
      // 169.254.x.x (link-local / AWS metadata)
      if (a === 169 && b === 254) return { valid: false, error: 'Link-local addresses are not allowed' };
      // 0.x.x.x
      if (a === 0) return { valid: false, error: 'Invalid IP address' };
    }

    // Block common internal hostnames
    const blockedHostnames = ['metadata.google.internal', 'metadata', 'instance-data'];
    if (blockedHostnames.some(blocked => hostname === blocked || hostname.endsWith('.' + blocked))) {
      return { valid: false, error: 'Internal hostnames are not allowed' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const url = body?.url;

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL to prevent SSRF
    const validation = validateURL(url);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping URL:', url);

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      // Limit response size (10MB max)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
        throw new Error('Response too large');
      }

      const html = await response.text();

      // Additional size check after reading
      if (html.length > 10 * 1024 * 1024) {
        throw new Error('Response too large');
      }

      // Extract JSON-LD structured data (Schema.org Recipe)
      const recipe = parseRecipeFromHTML(html);

      console.log('Parsed recipe:', recipe);

      return new Response(
        JSON.stringify(recipe),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape recipe';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

  // Try to find JSON-LD structured data
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  
  if (jsonLdMatches) {
    console.log(`Found ${jsonLdMatches.length} JSON-LD blocks`);
    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        const data = JSON.parse(jsonContent);
        
        // Handle @graph structure
        const recipes = findRecipeSchema(data);
        console.log(`Found ${recipes.length} recipe schemas`);
        
        if (recipes.length > 0) {
          const recipeData = recipes[0];
          console.log('Recipe data keys:', Object.keys(recipeData));
          
          recipe.title = recipeData.name || null;
          recipe.image = extractImage(recipeData.image);
          recipe.ingredients = extractIngredients(recipeData.recipeIngredient);
          recipe.instructions = extractInstructions(recipeData.recipeInstructions);
          recipe.prepTime = formatDuration(recipeData.prepTime);
          recipe.cookTime = formatDuration(recipeData.cookTime || recipeData.totalTime);
          recipe.servings = extractServings(recipeData.recipeYield);
          
          // If we got good data, stop looking
          if (recipe.ingredients.length > 0 || recipe.instructions.length > 0) {
            break;
          }
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD block:', e);
        continue;
      }
    }
  }

  // Fallback: Try WPRM (WordPress Recipe Maker) format - very common
  if (recipe.ingredients.length === 0) {
    const wprmIngredients = extractWPRMIngredients(html);
    if (wprmIngredients.length > 0) {
      recipe.ingredients = wprmIngredients;
      console.log('Extracted ingredients from WPRM format');
    }
  }

  if (recipe.instructions.length === 0) {
    const wprmInstructions = extractWPRMInstructions(html);
    if (wprmInstructions.length > 0) {
      recipe.instructions = wprmInstructions;
      console.log('Extracted instructions from WPRM format');
    }
  }

  // Fallback: Try common recipe card HTML patterns
  if (recipe.ingredients.length === 0) {
    const htmlIngredients = extractIngredientsFromHTML(html);
    if (htmlIngredients.length > 0) {
      recipe.ingredients = htmlIngredients;
      console.log('Extracted ingredients from HTML');
    }
  }

  if (recipe.instructions.length === 0) {
    const htmlInstructions = extractInstructionsFromHTML(html);
    if (htmlInstructions.length > 0) {
      recipe.instructions = htmlInstructions;
      console.log('Extracted instructions from HTML');
    }
  }

  // Fallback: Try to extract from meta tags if JSON-LD failed
  if (!recipe.title) {
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) ||
                       html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      recipe.title = decodeHTMLEntities(titleMatch[1]);
    }
  }

  if (!recipe.image) {
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
    if (imageMatch) {
      recipe.image = imageMatch[1];
    }
  }

  return recipe;
}

// Extract ingredients from WordPress Recipe Maker (WPRM) format
function extractWPRMIngredients(html: string): string[] {
  const ingredients: string[] = [];
  
  // WPRM uses class="wprm-recipe-ingredient"
  const ingredientMatches = html.matchAll(/<li[^>]*class="[^"]*wprm-recipe-ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi);
  for (const match of ingredientMatches) {
    const text = stripHTML(match[1]).trim();
    if (text) ingredients.push(decodeHTMLEntities(text));
  }
  
  return ingredients;
}

// Extract instructions from WPRM format
function extractWPRMInstructions(html: string): string[] {
  const instructions: string[] = [];
  
  // WPRM uses class="wprm-recipe-instruction"
  const instructionMatches = html.matchAll(/<li[^>]*class="[^"]*wprm-recipe-instruction[^"]*"[^>]*>([\s\S]*?)<\/li>/gi);
  for (const match of instructionMatches) {
    // Get text from instruction-text span if present
    const textMatch = match[1].match(/<span[^>]*class="[^"]*wprm-recipe-instruction-text[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const text = textMatch ? stripHTML(textMatch[1]).trim() : stripHTML(match[1]).trim();
    if (text) instructions.push(decodeHTMLEntities(text));
  }
  
  return instructions;
}

// Extract ingredients from common HTML patterns
function extractIngredientsFromHTML(html: string): string[] {
  const ingredients: string[] = [];
  
  // Look for common ingredient container patterns
  const containerPatterns = [
    /<div[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<ul[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
    /<section[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
  ];
  
  for (const pattern of containerPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      // Extract list items from container
      const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      for (const li of liMatches) {
        const text = stripHTML(li[1]).trim();
        if (text && text.length > 2 && text.length < 500) {
          ingredients.push(decodeHTMLEntities(text));
        }
      }
      if (ingredients.length > 0) break;
    }
    if (ingredients.length > 0) break;
  }
  
  return ingredients;
}

// Extract instructions from common HTML patterns
function extractInstructionsFromHTML(html: string): string[] {
  const instructions: string[] = [];
  
  // Look for common instruction container patterns
  const containerPatterns = [
    /<div[^>]*class="[^"]*instructions?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*directions?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*steps?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<ol[^>]*class="[^"]*instructions?[^"]*"[^>]*>([\s\S]*?)<\/ol>/gi,
  ];
  
  for (const pattern of containerPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      // Extract list items or paragraphs
      const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      for (const li of liMatches) {
        const text = stripHTML(li[1]).trim();
        if (text && text.length > 5 && text.length < 2000) {
          instructions.push(decodeHTMLEntities(text));
        }
      }
      
      // Also try paragraphs if no list items
      if (instructions.length === 0) {
        const pMatches = match[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        for (const p of pMatches) {
          const text = stripHTML(p[1]).trim();
          if (text && text.length > 10 && text.length < 2000) {
            instructions.push(decodeHTMLEntities(text));
          }
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
  
  // Direct Recipe type
  if (data['@type'] === 'Recipe' || (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
    recipes.push(data);
    return recipes;
  }
  
  // Check @graph array
  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
        recipes.push(item);
      }
    }
  }
  
  // Check if it's an array of schemas
  if (Array.isArray(data)) {
    for (const item of data) {
      recipes.push(...findRecipeSchema(item));
    }
  }
  
  return recipes;
}

function extractImage(image: any): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return extractImage(image[0]);
  if (image.url) return image.url;
  if (image['@id']) return image['@id'];
  return null;
}

function extractIngredients(ingredients: any): string[] {
  if (!ingredients) return [];
  if (Array.isArray(ingredients)) {
    return ingredients.map((ing: any) => {
      if (typeof ing === 'string') return decodeHTMLEntities(ing.trim());
      return '';
    }).filter(Boolean);
  }
  return [];
}

function extractInstructions(instructions: any): string[] {
  if (!instructions) return [];
  
  const result: string[] = [];
  
  const processInstruction = (item: any) => {
    if (typeof item === 'string') {
      result.push(decodeHTMLEntities(stripHTML(item.trim())));
    } else if (item.text) {
      result.push(decodeHTMLEntities(stripHTML(item.text.trim())));
    } else if (item['@type'] === 'HowToStep' && item.text) {
      result.push(decodeHTMLEntities(stripHTML(item.text.trim())));
    } else if (item['@type'] === 'HowToSection' && item.itemListElement) {
      for (const step of item.itemListElement) {
        processInstruction(step);
      }
    }
  };
  
  if (Array.isArray(instructions)) {
    for (const instruction of instructions) {
      processInstruction(instruction);
    }
  } else {
    processInstruction(instructions);
  }
  
  return result.filter(Boolean);
}

function formatDuration(duration: string | null | undefined): string | null {
  if (!duration) return null;
  
  // Parse ISO 8601 duration (e.g., PT30M, PT1H30M)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (match) {
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} min${minutes > 1 ? 's' : ''}`;
    }
  }
  
  // Return as-is if not parseable
  return duration.replace('PT', '').toLowerCase();
}

function extractServings(yield_: any): string | null {
  if (!yield_) return null;
  if (typeof yield_ === 'string') return yield_;
  if (typeof yield_ === 'number') return `${yield_} servings`;
  if (Array.isArray(yield_)) return yield_[0]?.toString() || null;
  return null;
}

function stripHTML(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}
