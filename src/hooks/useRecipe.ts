import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tag, RecipeWithTags } from '@/types/recipe';

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async (): Promise<RecipeWithTags | null> => {
      if (!id) return null;

      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();

      if (recipeError) throw recipeError;

      // Fetch tags for this recipe
      const { data: recipeTags, error: tagsError } = await supabase
        .from('recipe_tags')
        .select('tag_id, tags(*)')
        .eq('recipe_id', id);

      if (tagsError) throw tagsError;

      const tags = (recipeTags || [])
        .map((rt) => rt.tags as unknown as Tag)
        .filter(Boolean);

      return {
        ...recipe,
        ingredients: (recipe.ingredients as string[]) || [],
        instructions: (recipe.instructions as string[]) || [],
        tags,
      };
    },
    enabled: !!id,
  });
}
