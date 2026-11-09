import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/integrations/neon/client';
import { RecipeWithTags } from '@/types/recipe';

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async (): Promise<RecipeWithTags | null> => {
      if (!id) return null;
      return apiFetch<RecipeWithTags>(`/recipes/${id}`);
    },
    enabled: !!id,
  });
}
