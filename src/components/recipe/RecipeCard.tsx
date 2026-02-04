import { motion } from 'framer-motion';
import { Clock, Users, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { RecipeWithTags } from '@/types/recipe';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: RecipeWithTags;
  onEdit: (recipe: RecipeWithTags) => void;
  onDelete: (id: string) => void;
  index: number;
}

const placeholderImages = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
];

export function RecipeCard({ recipe, onEdit, onDelete, index }: RecipeCardProps) {
  const imageUrl = recipe.image_url || placeholderImages[index % placeholderImages.length];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="recipe-card group"
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        <img
          src={imageUrl}
          alt={recipe.title}
          className="recipe-card-image transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <button
            onClick={() => onEdit(recipe)}
            className="p-2 rounded-full bg-white/90 text-primary shadow-md hover:bg-white hover:scale-110 transition-all duration-200"
            aria-label="Edit recipe"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(recipe.id)}
            className="p-2 rounded-full bg-white/90 text-destructive shadow-md hover:bg-white hover:scale-110 transition-all duration-200"
            aria-label="Delete recipe"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Source link */}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 p-2 rounded-full bg-white/90 text-muted-foreground shadow-md hover:bg-white hover:text-primary transition-all duration-200 opacity-0 group-hover:opacity-100"
            aria-label="View original source"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="recipe-tag">
                {tag.name}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="recipe-tag recipe-tag-amber">
                +{recipe.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className="font-serif text-xl font-semibold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {recipe.title}
        </h3>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {recipe.cook_time && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{recipe.cook_time}</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{recipe.servings}</span>
            </div>
          )}
        </div>

        {/* Ingredients preview */}
        {recipe.ingredients.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {recipe.ingredients.slice(0, 3).join(' • ')}
            {recipe.ingredients.length > 3 && ' ...'}
          </p>
        )}
      </div>
    </motion.article>
  );
}
