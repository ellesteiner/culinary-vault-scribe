import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToggleLike } from '@/hooks/useLikes';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LikeButtonProps {
  recipeId: string;
  likeCount: number;
  isLiked: boolean;
}

export function LikeButton({ recipeId, likeCount, isLiked }: LikeButtonProps) {
  const toggleLike = useToggleLike();
  const { user } = useAuth();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to like recipes');
      return;
    }
    toggleLike.mutate(recipeId);
  };

  return (
    <button
      onClick={handleClick}
      disabled={toggleLike.isPending}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
      aria-label={isLiked ? 'Unlike recipe' : 'Like recipe'}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isLiked ? 'liked' : 'not-liked'}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.5 }}
          transition={{ duration: 0.2 }}
        >
          <Heart
            className={`w-4 h-4 transition-colors duration-200 ${
              isLiked ? 'fill-primary text-primary' : ''
            }`}
          />
        </motion.div>
      </AnimatePresence>
      <span>{likeCount}</span>
    </button>
  );
}
