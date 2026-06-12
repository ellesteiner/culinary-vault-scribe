import { useState } from 'react';
import { Sparkles, ChefHat, Loader2, RotateCcw, BookmarkPlus, Clock, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateRecipe } from '@/hooks/useRecipes';
import { toast } from 'sonner';

interface AIRecipe {
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: string | number;
  tags: string[];
  ingredients: string[];
  steps: string[];
}

interface AISousChefModalProps {
  open: boolean;
  onClose: () => void;
}

export function AISousChefModal({ open, onClose }: AISousChefModalProps) {
  const [ingredients, setIngredients] = useState('');
  const [mood, setMood] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<AIRecipe | null>(null);
  const { user, profile } = useAuth();
  const createRecipe = useCreateRecipe();

  const reset = () => {
    setRecipe(null);
    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    setTimeout(() => {
      setIngredients('');
      setMood('');
      reset();
    }, 200);
  };

  const handleGenerate = async () => {
    if (!ingredients.trim()) {
      toast.error('Please add some ingredients');
      return;
    }
    setLoading(true);
    setRecipe(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-sous-chef', {
        body: { ingredients: ingredients.trim(), mood: mood.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.recipe) throw new Error('No recipe returned');
      setRecipe(data.recipe as AIRecipe);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to generate recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save recipes');
      return;
    }
    if (!recipe) return;

    await createRecipe.mutateAsync({
      data: {
        title: recipe.title,
        source_url: '',
        image_url: '',
        ingredients: recipe.ingredients,
        instructions: recipe.steps,
        notes: recipe.description || '',
        cook_time: String(recipe.cookTime || ''),
        prep_time: String(recipe.prepTime || ''),
        servings: String(recipe.servings || ''),
        tagIds: [],
      },
      userId: user.id,
      ownerName: profile?.full_name || user.email || 'Anonymous',
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!recipe && !loading && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl flex items-center gap-2">
                <ChefHat className="w-6 h-6 text-primary" />
                What's in your kitchen?
              </DialogTitle>
              <DialogDescription>
                Tell your sous chef what you have and what you're craving.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ai-ingredients">Your ingredients</Label>
                <Textarea
                  id="ai-ingredients"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="e.g. chicken thighs, garlic, lemon, spinach..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-mood">What are you in the mood for?</Label>
                <Textarea
                  id="ai-mood"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g. a quick weeknight dinner, something spicy, a light lunch..."
                  className="min-h-[70px]"
                />
              </div>
              <Button
                onClick={handleGenerate}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px] gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Create My Recipe
              </Button>
            </div>
          </>
        )}

        {loading && (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <ChefHat className="w-12 h-12 text-primary" />
              <Loader2 className="w-6 h-6 animate-spin text-primary absolute -bottom-1 -right-1" />
            </div>
            <p className="font-serif text-xl text-foreground">Your sous chef is cooking...</p>
            <p className="text-sm text-muted-foreground">Sharpening knives and choosing spices.</p>
          </div>
        )}

        {recipe && !loading && (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle asChild>
                <h2 className="font-serif text-3xl text-foreground">{recipe.title}</h2>
              </DialogTitle>
              {recipe.description && (
                <DialogDescription className="text-base">{recipe.description}</DialogDescription>
              )}
            </DialogHeader>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-y border-border py-3">
              {recipe.prepTime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Prep: {recipe.prepTime}
                </span>
              )}
              {recipe.cookTime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Cook: {recipe.cookTime}
                </span>
              )}
              {recipe.servings && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Serves: {recipe.servings}
                </span>
              )}
            </div>

            {recipe.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipe.tags.map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-serif text-xl mb-3 text-foreground">Ingredients</h3>
                <ul className="space-y-2">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary">•</span>
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-serif text-xl mb-3 text-foreground">Steps</h3>
                <ol className="space-y-3">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={createRecipe.isPending || !user}
                className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px] gap-2 flex-1"
              >
                <BookmarkPlus className="w-4 h-4" />
                {user ? 'Save to My Cookbook' : 'Sign in to save'}
              </Button>
              <Button
                variant="outline"
                onClick={reset}
                className="min-h-[44px] gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
