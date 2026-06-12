import { useState, useMemo } from 'react';
import { Check, Plus, X, Tag as TagIcon, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag } from '@/types/recipe';
import { useTags, useCreateTag } from '@/hooks/useRecipes';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  suggestionContext?: { title: string; ingredients: string[] };
}

export function TagSelector({ selectedTagIds, onChange, suggestionContext }: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();

  const filteredTags = useMemo(() => {
    if (!inputValue) return tags;
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [tags, inputValue]);

  const canCreateTag = useMemo(() => {
    if (!inputValue.trim()) return false;
    return !tags.some(
      (tag) => tag.name.toLowerCase() === inputValue.trim().toLowerCase()
    );
  }, [tags, inputValue]);

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!canCreateTag) return;
    
    const newTag = await createTag.mutateAsync(inputValue.trim());
    if (newTag) {
      onChange([...selectedTagIds, newTag.id]);
      setInputValue('');
    }
  };

  const removeTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };
  const handleSuggest = async () => {
    if (!suggestionContext || tags.length === 0) return;
    const { title, ingredients } = suggestionContext;
    const cleanIngredients = ingredients.filter(Boolean);
    if (!title.trim() && cleanIngredients.length === 0) {
      toast.error('Add a title or ingredients first to get tag suggestions');
      return;
    }
    setSuggesting(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-tags', {
        body: {
          title,
          ingredients: cleanIngredients,
          availableTags: tags.map((t) => t.name),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const names: string[] = data?.tags ?? [];
      const matched = names
        .map((n) => tags.find((t) => t.name.toLowerCase() === n.toLowerCase()))
        .filter((t): t is Tag => !!t && !selectedTagIds.includes(t.id));
      setSuggestions(matched);
      if (matched.length === 0) toast.info('No new tag suggestions');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Could not get tag suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = (tag: Tag) => {
    if (!selectedTagIds.includes(tag.id)) onChange([...selectedTagIds, tag.id]);
    setSuggestions((prev) => prev.filter((t) => t.id !== tag.id));
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <TagIcon className="w-4 h-4" />
          Tags
        </label>
        {suggestionContext && (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting || tags.length === 0}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 min-h-[32px]"
          >
            {suggesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {suggesting ? 'Thinking...' : 'Suggest tags'}
          </button>
        )}
      </div>

      {/* AI suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-lg bg-primary/5 border border-primary/15"
          >
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" />
              Suggested for this recipe — tap to add
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => acceptSuggestion(tag)}
                  className="recipe-tag border border-dashed border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {tag.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Selected tags */}
      <AnimatePresence>
        {selectedTags.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            {selectedTags.map((tag) => (
              <motion.span
                key={tag.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="recipe-tag recipe-tag-burgundy flex items-center gap-1.5 pr-1.5"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => removeTag(tag.id)}
                  className="p-0.5 hover:bg-burgundy/20 rounded-full transition-colors"
                  aria-label={`Remove ${tag.name} tag`}
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag input */}
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search or create tags..."
          className="input-cookbook"
        />

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (filteredTags.length > 0 || canCreateTag) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 w-full mt-2 py-2 bg-card rounded-lg border border-border shadow-cookbook-lg max-h-48 overflow-auto"
            >
              {/* Existing tags */}
              {filteredTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm flex items-center justify-between",
                      "hover:bg-muted transition-colors",
                      isSelected && "bg-primary/5 text-primary"
                    )}
                  >
                    <span>{tag.name}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}

              {/* Create new tag option */}
              {canCreateTag && (
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={createTag.isPending}
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted transition-colors text-primary font-medium border-t border-border mt-1 pt-3"
                >
                  <Plus className="w-4 h-4" />
                  Create "{inputValue.trim()}"
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Loading tags...</p>
      )}
    </div>
  );
}
