import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/integrations/neon/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LikeCounts {
  [recipeId: string]: number;
}

interface UserLikes {
  [recipeId: string]: boolean;
}

export function useLikeCounts() {
  return useQuery({
    queryKey: ['like-counts'],
    queryFn: () => apiFetch<LikeCounts>('/likes/counts'),
  });
}

export function useUserLikes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-likes', user?.id],
    queryFn: async (): Promise<UserLikes> => {
      if (!user) return {};
      return apiFetch<UserLikes>('/likes/mine');
    },
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipeId: string) => {
      return apiFetch<{ liked: boolean }>('/likes/toggle', {
        method: 'POST',
        body: JSON.stringify({ recipe_id: recipeId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['like-counts'] });
      queryClient.invalidateQueries({ queryKey: ['user-likes'] });
    },
    onError: (error) => {
      console.error('Like error:', error);
      toast.error('Failed to like recipe');
    },
  });
}
