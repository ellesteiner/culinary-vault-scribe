import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
    queryFn: async (): Promise<LikeCounts> => {
      const { data, error } = await supabase
        .rpc('get_recipe_like_counts');

      if (error) throw error;

      const counts: LikeCounts = {};
      (data || []).forEach((row: { recipe_id: string; like_count: number }) => {
        counts[row.recipe_id] = row.like_count;
      });
      return counts;
    },
  });
}

export function useUserLikes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-likes', user?.id],
    queryFn: async (): Promise<UserLikes> => {
      if (!user) return {};

      const { data, error } = await supabase
        .from('recipe_likes')
        .select('recipe_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const likes: UserLikes = {};
      (data || []).forEach((like) => {
        likes[like.recipe_id] = true;
      });
      return likes;
    },
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipeId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-like`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ recipe_id: recipeId }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to toggle like');
      }

      return res.json();
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
