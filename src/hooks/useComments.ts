import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/integrations/neon/client';
import { RecipeComment } from '@/types/comment';
import { toast } from 'sonner';

export function useComments(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['comments', recipeId],
    queryFn: async (): Promise<RecipeComment[]> => {
      if (!recipeId) return [];
      return apiFetch<RecipeComment[]>(`/recipes/${recipeId}/comments`);
    },
    enabled: !!recipeId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipeId, content }: { recipeId: string; content: string }) => {
      return apiFetch(`/recipes/${recipeId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
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
    mutationFn: async ({ id, content }: { id: string; recipeId: string; content: string }) => {
      await apiFetch(`/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) });
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
    mutationFn: async ({ id }: { id: string; recipeId: string }) => {
      await apiFetch(`/comments/${id}`, { method: 'DELETE' });
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
