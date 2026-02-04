import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link, Loader2, Sparkles, Clock, Users, ChefHat, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DynamicList } from './DynamicList';
import { TagSelector } from './TagSelector';
import { RecipeFormData, RecipeWithTags, defaultRecipeFormData } from '@/types/recipe';
import { useCreateRecipe, useUpdateRecipe } from '@/hooks/useRecipes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe?: RecipeWithTags | null;
}

export function RecipeModal({ isOpen, onClose, recipe }: RecipeModalProps) {
  const [formData, setFormData] = useState<RecipeFormData>(defaultRecipeFormData);
  const [urlInput, setUrlInput] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const isEditing = !!recipe;
  const isSubmitting = createRecipe.isPending || updateRecipe.isPending;

  // Reset form when modal opens/closes or recipe changes
  useEffect(() => {
    if (isOpen) {
      if (recipe) {
        setFormData({
          title: recipe.title,
          source_url: recipe.source_url || '',
          image_url: recipe.image_url || '',
          ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [''],
          instructions: recipe.instructions.length > 0 ? recipe.instructions : [''],
          notes: recipe.notes || '',
          cook_time: recipe.cook_time || '',
          prep_time: recipe.prep_time || '',
          servings: recipe.servings || '',
          tagIds: recipe.tags.map((t) => t.id),
        });
        setUrlInput(recipe.source_url || '');
      } else {
        setFormData(defaultRecipeFormData);
        setUrlInput('');
      }
    }
  }, [isOpen, recipe]);

  const updateField = <K extends keyof RecipeFormData>(
    field: K,
    value: RecipeFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleScrape = async () => {
    if (!urlInput.trim()) return;

    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-recipe', {
        body: { url: urlInput.trim() },
      });

      if (error) throw error;

      if (data) {
        setFormData((prev) => ({
          ...prev,
          title: data.title || prev.title,
          source_url: urlInput.trim(),
          image_url: data.image || prev.image_url,
          ingredients: data.ingredients?.length > 0 ? data.ingredients : prev.ingredients,
          instructions: data.instructions?.length > 0 ? data.instructions : prev.instructions,
          cook_time: data.cookTime || prev.cook_time,
          prep_time: data.prepTime || prev.prep_time,
          servings: data.servings || prev.servings,
        }));
        toast.success('Recipe imported successfully!');
      }
    } catch (error) {
      console.error('Scraping error:', error);
      toast.error('Could not import recipe. Try adding details manually.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please add a recipe title');
      return;
    }

    try {
      if (isEditing && recipe) {
        await updateRecipe.mutateAsync({ id: recipe.id, data: formData });
      } else {
        await createRecipe.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      // Error handled in mutation
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border bg-cream/50">
          <DialogTitle className="font-serif text-2xl flex items-center gap-3">
            <ChefHat className="w-6 h-6 text-primary" />
            {isEditing ? 'Edit Recipe' : 'Add New Recipe'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* URL Import Section */}
            {!isEditing && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/10 border border-primary/10"
              >
                <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Import from URL
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste recipe URL..."
                      className="pl-10 input-cookbook"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleScrape}
                    disabled={!urlInput.trim() || isScraping}
                    className="btn-cookbook px-6"
                  >
                    {isScraping ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Import'
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Title */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Recipe Title *
              </label>
              <Input
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="E.g., Grandma's Apple Pie"
                className="input-cookbook font-serif text-lg"
                required
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Image URL
              </label>
              <Input
                value={formData.image_url}
                onChange={(e) => updateField('image_url', e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="input-cookbook"
              />
              {formData.image_url && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 relative rounded-lg overflow-hidden w-32 h-24"
                >
                  <img
                    src={formData.image_url}
                    alt="Recipe preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </motion.div>
              )}
            </div>

            {/* Time and Servings */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Prep Time
                </label>
                <Input
                  value={formData.prep_time}
                  onChange={(e) => updateField('prep_time', e.target.value)}
                  placeholder="15 mins"
                  className="input-cookbook"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Cook Time
                </label>
                <Input
                  value={formData.cook_time}
                  onChange={(e) => updateField('cook_time', e.target.value)}
                  placeholder="30 mins"
                  className="input-cookbook"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Servings
                </label>
                <Input
                  value={formData.servings}
                  onChange={(e) => updateField('servings', e.target.value)}
                  placeholder="4 servings"
                  className="input-cookbook"
                />
              </div>
            </div>

            {/* Ingredients */}
            <DynamicList
              items={formData.ingredients}
              onChange={(items) => updateField('ingredients', items)}
              label="Ingredients"
              placeholder="E.g., 2 cups flour"
            />

            {/* Instructions */}
            <DynamicList
              items={formData.instructions}
              onChange={(items) => updateField('instructions', items)}
              label="Instructions"
              placeholder="E.g., Preheat oven to 350°F..."
              multiline
            />

            {/* Tags */}
            <TagSelector
              selectedTagIds={formData.tagIds}
              onChange={(tagIds) => updateField('tagIds', tagIds)}
            />

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Notes
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any tips, variations, or personal notes..."
                className="input-cookbook min-h-[100px] resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 px-6 py-4 border-t border-border bg-background/95 backdrop-blur-sm flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="btn-cookbook"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Add to Cookbook'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
