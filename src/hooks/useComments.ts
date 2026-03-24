import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecipeComment } from '@/types/comment';
import { toast } from 'sonner';

export function useComments(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['comments', recipeId],
    queryFn: async (): Promise<RecipeComment[]> => {
      if (!recipeId) return [];

      const { data, error } = await supabase
        .from('recipe_comments')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!recipeId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipeId, content }: { recipeId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in to comment');
      
      const { data, error } = await supabase
        .from('recipe_comments')
        .insert({ recipe_id: recipeId, content, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.recipeId] });
      toast.success('Comment added');
    },
    onError: (error) => {
      console.error('Error creating comment:', error);
      toast.error('Failed to add comment');
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, recipeId, content }: { id: string; recipeId: string; content: string }) => {
      const { error } = await supabase
        .from('recipe_comments')
        .update({ content })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.recipeId] });
      toast.success('Comment updated');
    },
    onError: (error) => {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, recipeId }: { id: string; recipeId: string }) => {
      const { error } = await supabase
        .from('recipe_comments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.recipeId] });
      toast.success('Comment deleted');
    },
    onError: (error) => {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    },
  });
}
