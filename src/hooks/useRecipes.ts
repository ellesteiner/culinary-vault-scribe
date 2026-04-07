import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, Tag, RecipeWithTags, RecipeFormData } from '@/types/recipe';
import { toast } from 'sonner';

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: async (): Promise<RecipeWithTags[]> => {
      const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (recipesError) throw recipesError;

      const { data: recipeTags, error: tagsError } = await supabase
        .from('recipe_tags')
        .select('recipe_id, tag_id, tags(*)');

      if (tagsError) throw tagsError;

      const recipesWithTags = (recipes || []).map((recipe) => {
        const associatedTags = (recipeTags || [])
          .filter((rt) => rt.recipe_id === recipe.id)
          .map((rt) => rt.tags as unknown as Tag)
          .filter(Boolean);

        return {
          ...recipe,
          ingredients: (recipe.ingredients as string[]) || [],
          instructions: (recipe.instructions as string[]) || [],
          tags: associatedTags,
        };
      });

      return recipesWithTags;
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, userId, ownerName }: { data: RecipeFormData; userId: string; ownerName: string }) => {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          title: data.title,
          source_url: data.source_url || null,
          image_url: data.image_url || null,
          ingredients: data.ingredients.filter(Boolean),
          instructions: data.instructions.filter(Boolean),
          notes: data.notes || null,
          cook_time: data.cook_time || null,
          prep_time: data.prep_time || null,
          servings: data.servings || null,
          user_id: userId,
          owner_name: ownerName,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      if (data.tagIds.length > 0) {
        const { error: tagsError } = await supabase
          .from('recipe_tags')
          .insert(
            data.tagIds.map((tagId) => ({
              recipe_id: recipe.id,
              tag_id: tagId,
            }))
          );

        if (tagsError) throw tagsError;
      }

      return recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe saved to your cookbook!');
    },
    onError: (error) => {
      console.error('Error creating recipe:', error);
      toast.error('Failed to save recipe');
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RecipeFormData }) => {
      const { error: recipeError } = await supabase
        .from('recipes')
        .update({
          title: data.title,
          source_url: data.source_url || null,
          image_url: data.image_url || null,
          ingredients: data.ingredients.filter(Boolean),
          instructions: data.instructions.filter(Boolean),
          notes: data.notes || null,
          cook_time: data.cook_time || null,
          prep_time: data.prep_time || null,
          servings: data.servings || null,
        })
        .eq('id', id);

      if (recipeError) throw recipeError;

      const { error: deleteError } = await supabase
        .from('recipe_tags')
        .delete()
        .eq('recipe_id', id);

      if (deleteError) throw deleteError;

      if (data.tagIds.length > 0) {
        const { error: tagsError } = await supabase
          .from('recipe_tags')
          .insert(
            data.tagIds.map((tagId) => ({
              recipe_id: id,
              tag_id: tagId,
            }))
          );

        if (tagsError) throw tagsError;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe', variables.id] });
      toast.success('Recipe updated!');
    },
    onError: (error) => {
      console.error('Error updating recipe:', error);
      toast.error('Failed to update recipe');
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe deleted');
    },
    onError: (error) => {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe');
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('tags')
        .insert({ name })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error) => {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
    },
  });
}
