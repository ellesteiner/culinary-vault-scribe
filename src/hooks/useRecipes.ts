import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/integrations/neon/client';
import { Tag, RecipeWithTags, RecipeFormData } from '@/types/recipe';
import { toast } from 'sonner';

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiFetch<RecipeWithTags[]>('/recipes'),
  });
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<Tag[]>('/tags'),
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, ownerName }: { data: RecipeFormData; ownerName: string }) => {
      return apiFetch('/recipes', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          source_url: data.source_url || null,
          image_url: data.image_url || null,
          ingredients: data.ingredients.filter(Boolean),
          instructions: data.instructions.filter(Boolean),
          notes: data.notes || null,
          cook_time: data.cook_time || null,
          prep_time: data.prep_time || null,
          servings: data.servings || null,
          owner_name: ownerName,
          tagIds: data.tagIds,
        }),
      });
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
      return apiFetch(`/recipes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: data.title,
          source_url: data.source_url || null,
          image_url: data.image_url || null,
          ingredients: data.ingredients.filter(Boolean),
          instructions: data.instructions.filter(Boolean),
          notes: data.notes || null,
          cook_time: data.cook_time || null,
          prep_time: data.prep_time || null,
          servings: data.servings || null,
          tagIds: data.tagIds,
        }),
      });
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
      await apiFetch(`/recipes/${id}`, { method: 'DELETE' });
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
      return apiFetch<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) });
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
