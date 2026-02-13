import { motion, AnimatePresence } from 'framer-motion';
import { RecipeCard } from './RecipeCard';
import { RecipeWithTags } from '@/types/recipe';
import { UtensilsCrossed } from 'lucide-react';

interface RecipeGridProps {
  recipes: RecipeWithTags[];
  onEdit: (recipe: RecipeWithTags) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  likeCounts?: Record<string, number>;
  userLikes?: Record<string, boolean>;
}

export function RecipeGrid({ recipes, onEdit, onDelete, isLoading, likeCounts = {}, userLikes = {} }: RecipeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="recipe-card animate-pulse">
            <div className="aspect-[4/3] bg-muted" />
            <div className="p-5 space-y-3">
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-muted rounded-full" />
                <div className="h-6 w-20 bg-muted rounded-full" />
              </div>
              <div className="h-7 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
          <UtensilsCrossed className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="font-serif text-2xl text-foreground mb-2">
          Your cookbook is empty
        </h3>
        <p className="text-muted-foreground max-w-md">
          Start building your collection by adding your first recipe. 
          Paste a URL to import automatically or add one manually.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      layout
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <AnimatePresence mode="popLayout">
        {recipes.map((recipe, index) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onEdit={onEdit}
            onDelete={onDelete}
            index={index}
            likeCount={likeCounts[recipe.id] || 0}
            isLiked={userLikes[recipe.id] || false}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
