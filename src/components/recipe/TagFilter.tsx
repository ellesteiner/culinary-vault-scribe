import { motion } from 'framer-motion';
import { Tag } from '@/types/recipe';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export function TagFilter({ tags, selectedTagIds, onChange }: TagFilterProps) {
  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  if (tags.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-sm font-medium text-muted-foreground mr-1">Filter:</span>
      
      {tags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id);
        return (
          <motion.button
            key={tag.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleTag(tag.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
              "border",
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            {tag.name}
          </motion.button>
        );
      })}

      {selectedTagIds.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={clearAll}
          className="px-2 py-1.5 rounded-full text-sm text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Clear
        </motion.button>
      )}
    </motion.div>
  );
}
