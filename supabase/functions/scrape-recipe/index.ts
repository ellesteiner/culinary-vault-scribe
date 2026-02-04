const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping URL:', url);

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeScraper/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract JSON-LD structured data (Schema.org Recipe)
    const recipe = parseRecipeFromHTML(html);

    console.log('Parsed recipe:', recipe);

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        const data = JSON.parse(jsonContent);
        
        // Handle @graph structure
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
          
          break;
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD block:', e);
        continue;
      }
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
