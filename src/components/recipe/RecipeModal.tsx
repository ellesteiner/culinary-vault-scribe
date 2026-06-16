import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, Loader2, Sparkles, Clock, Users, ChefHat, Image as ImageIcon, X, RefreshCw, ClipboardPaste, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DynamicList } from './DynamicList';
import { TagSelector } from './TagSelector';
import { RecipeFormData, RecipeWithTags, defaultRecipeFormData } from '@/types/recipe';
import { useCreateRecipe, useUpdateRecipe, useTags, useCreateTag } from '@/hooks/useRecipes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ImportMode = 'url' | 'paste';


interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe?: RecipeWithTags | null;
}

export function RecipeModal({ isOpen, onClose, recipe }: RecipeModalProps) {
  const [formData, setFormData] = useState<RecipeFormData>(defaultRecipeFormData);
  const [urlInput, setUrlInput] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('url');
  const [isScraping, setIsScraping] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const { user, profile } = useAuth();

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const { data: allTags = [] } = useTags();
  const createTag = useCreateTag();

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
        setPasteInput('');
        setImportMode('url');
      }
    }
  }, [isOpen, recipe]);

  const handleParse = async () => {
    const text = pasteInput.trim();
    if (!text) return;

    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-recipe', {
        body: { text },
      });

      if (error) throw error;
      if (!data || data.error) throw new Error(data?.error || 'Parse failed');

      // Resolve AI-suggested tag names to tag IDs, creating any that don't exist.
      const suggestedTagNames: string[] = Array.isArray(data.tags) ? data.tags : [];
      const tagIds: string[] = [];
      const existingByName = new Map(allTags.map((t) => [t.name.toLowerCase(), t]));

      for (const name of suggestedTagNames) {
        const key = name.toLowerCase();
        const existing = existingByName.get(key);
        if (existing) {
          tagIds.push(existing.id);
        } else {
          try {
            const created = await createTag.mutateAsync(name);
            if (created?.id) {
              tagIds.push(created.id);
              existingByName.set(key, created);
            }
          } catch (e) {
            // Skip tag creation failures; parsing should not fail because of tags.
            console.warn('Failed to create tag', name, e);
          }
        }
      }

      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        ingredients: data.ingredients?.length > 0 ? data.ingredients : prev.ingredients,
        instructions: data.instructions?.length > 0 ? data.instructions : prev.instructions,
        cook_time: data.cook_time || prev.cook_time,
        prep_time: data.prep_time || prev.prep_time,
        servings: data.servings || prev.servings,
        notes: data.notes || prev.notes,
        tagIds: tagIds.length > 0 ? Array.from(new Set([...prev.tagIds, ...tagIds])) : prev.tagIds,
      }));
      toast.success('Recipe parsed! Review and save below.');
    } catch (err) {
      console.error('Parse error:', err);
      toast.error('Could not parse recipe. Try editing details manually.');
    } finally {
      setIsParsing(false);
    }
  };


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
        if (!user) {
          toast.error('Please sign in to add a recipe');
          return;
        }
        await createRecipe.mutateAsync({
          data: formData,
          userId: user.id,
          ownerName: profile?.full_name || user.email || 'Unknown',
        });
      }
      onClose();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const clearImage = () => {
    updateField('image_url', '');
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
            {/* Import Section */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/10 border border-primary/10 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  {isEditing ? 'Re-import recipe' : 'Quick import'}
                </label>
                <div className="inline-flex rounded-md border border-border bg-background/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setImportMode('url')}
                    className={`px-3 py-1 text-xs rounded-sm transition-colors flex items-center gap-1.5 ${
                      importMode === 'url' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Link className="w-3 h-3" /> URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('paste')}
                    className={`px-3 py-1 text-xs rounded-sm transition-colors flex items-center gap-1.5 ${
                      importMode === 'paste' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ClipboardPaste className="w-3 h-3" /> Paste Recipe
                  </button>
                </div>
              </div>

              {importMode === 'url' ? (
                <>
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
                      ) : isEditing ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Re-import
                        </>
                      ) : (
                        'Import'
                      )}
                    </Button>
                  </div>
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">
                      Re-import will update the recipe with fresh data from the URL
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Textarea
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder={`Paste a recipe from anywhere — ChatGPT, a cookbook, a blog, an email, markdown, YAML, plain text, or a transcribed handwritten recipe.\n\nExample:\nGrandma's Apple Pie\nServes 8 — 20 min prep, 45 min bake\n\nIngredients\n- 6 apples, peeled and sliced\n- 3/4 cup sugar\n- 1 tsp cinnamon\n\nInstructions\n1. Preheat oven to 375°F.\n2. Toss apples with sugar and cinnamon.\n3. Pour into crust and bake 45 minutes.`}
                    className="input-cookbook min-h-[200px] font-mono text-sm leading-relaxed"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      AI will extract ingredients, steps, timing, and suggest tags. Review everything below before saving.
                    </p>
                    <Button
                      type="button"
                      onClick={handleParse}
                      disabled={!pasteInput.trim() || isParsing}
                      className="btn-cookbook px-6 shrink-0"
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Parse Recipe
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>


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

            {/* Image URL with preview and clear */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Recipe Image
              </label>
              <div className="flex gap-3">
                <Input
                  value={formData.image_url}
                  onChange={(e) => updateField('image_url', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="input-cookbook flex-1"
                />
                {formData.image_url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={clearImage}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {formData.image_url && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 relative rounded-lg overflow-hidden w-full max-w-xs"
                >
                  <img
                    src={formData.image_url}
                    alt="Recipe preview"
                    className="w-full h-40 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </motion.div>
              )}
            </div>

            {/* Source URL (for reference) */}
            {isEditing && formData.source_url && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Source URL
                </label>
                <Input
                  value={formData.source_url}
                  onChange={(e) => updateField('source_url', e.target.value)}
                  placeholder="Original recipe URL"
                  className="input-cookbook"
                />
              </div>
            )}

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
              suggestionContext={{ title: formData.title, ingredients: formData.ingredients }}
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
