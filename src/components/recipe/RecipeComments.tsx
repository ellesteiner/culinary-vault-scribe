import { useState } from 'react';
import { MessageSquare, Edit2, Trash2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/hooks/useComments';
import { RecipeComment } from '@/types/comment';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface RecipeCommentsProps {
  recipeId: string;
}

export function RecipeComments({ recipeId }: RecipeCommentsProps) {
  const { data: comments = [], isLoading } = useComments(recipeId);
  const { user } = useAuth();
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createComment.mutate({ recipeId, content: newComment.trim() });
    setNewComment('');
  };

  const handleEdit = (comment: RecipeComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editContent.trim()) return;
    updateComment.mutate({ id: editingId, recipeId, content: editContent.trim() });
    setEditingId(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = (id: string) => {
    deleteComment.mutate({ id, recipeId });
  };

  return (
    <div className="mt-8 pt-8 border-t border-border">
      <h3 className="font-serif text-xl text-foreground mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Comments
        {comments.length > 0 && (
          <span className="text-sm font-sans text-muted-foreground">({comments.length})</span>
        )}
      </h3>

      {/* Add Comment Form */}
      <div className="mb-6">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment or note about this recipe..."
          className="mb-2 resize-none"
          rows={3}
        />
        <Button
          onClick={handleSubmit}
          disabled={!newComment.trim() || createComment.isPending}
          size="sm"
          className="btn-cookbook"
        >
          <Send className="w-4 h-4 mr-2" />
          {createComment.isPending ? 'Adding...' : 'Add Comment'}
        </Button>
      </div>

      {/* Comments List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet. Be the first to add one!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-accent/5 rounded-lg p-4 border border-border"
            >
              {editingId === comment.id ? (
                <div>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="mb-2 resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveEdit}
                      disabled={!editContent.trim() || updateComment.isPending}
                      size="sm"
                    >
                      {updateComment.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                      size="sm"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-foreground whitespace-pre-wrap mb-2">{comment.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      {comment.updated_at !== comment.created_at && ' (edited)'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(comment)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(comment.id)}
                        disabled={deleteComment.isPending}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
