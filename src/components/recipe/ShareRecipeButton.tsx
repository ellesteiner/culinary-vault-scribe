import { useState } from 'react';
import { Share2, Copy, Mail, Link as LinkIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { RecipeWithTags } from '@/types/recipe';

interface ShareRecipeButtonProps {
  recipe: RecipeWithTags;
  /** Ingredients already scaled to the user's chosen serving size. */
  ingredients: string[];
  className?: string;
}

function buildPlainText(
  recipe: RecipeWithTags,
  ingredients: string[],
  url: string
): string {
  const lines: string[] = [];
  lines.push(recipe.title);
  lines.push('');
  if (recipe.servings) lines.push(`Servings: ${recipe.servings}`);
  if (recipe.prep_time) lines.push(`Prep time: ${recipe.prep_time}`);
  if (recipe.cook_time) lines.push(`Cook time: ${recipe.cook_time}`);
  if (recipe.servings || recipe.prep_time || recipe.cook_time) lines.push('');

  lines.push('INGREDIENTS');
  for (const ing of ingredients) lines.push(`- ${ing}`);
  lines.push('');

  lines.push('INSTRUCTIONS');
  recipe.instructions.forEach((step, i) => lines.push(`${i + 1}. ${step}`));

  if (recipe.notes) {
    lines.push('');
    lines.push('NOTES');
    lines.push(recipe.notes);
  }

  lines.push('');
  lines.push(`View recipe: ${url}`);
  return lines.join('\n');
}

function isMobileLikeShareable(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Only show native share UI on touch devices that support sharing text
  const hasShare = !!navigator.share;
  const isTouch =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  return hasShare && isTouch;
}

export function ShareRecipeButton({ recipe, ingredients, className }: ShareRecipeButtonProps) {
  const [open, setOpen] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = buildPlainText(recipe, ingredients, url);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
      setOpen(false);
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: recipe.title, text, url });
    } catch {
      /* user cancelled */
    }
  };

  const emailHref = `mailto:?subject=${encodeURIComponent(
    `Recipe: ${recipe.title}`
  )}&body=${encodeURIComponent(text)}`;

  if (isMobileLikeShareable()) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleNativeShare}
        className={`bg-white/95 backdrop-blur-sm hover:bg-white text-foreground border-border shadow-sm min-h-[44px] ${className ?? ''}`}
        aria-label="Share recipe"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`bg-white/95 backdrop-blur-sm hover:bg-white text-foreground border-border shadow-sm min-h-[44px] ${className ?? ''}`}
          aria-label="Share recipe"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <button
          onClick={() => copy(url, 'Link')}
          className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-md text-sm text-foreground hover:bg-accent/10 transition-colors"
        >
          <LinkIcon className="w-4 h-4 text-primary" />
          Copy link
        </button>
        <button
          onClick={() => copy(text, 'Recipe')}
          className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-md text-sm text-foreground hover:bg-accent/10 transition-colors"
        >
          <FileText className="w-4 h-4 text-primary" />
          Copy recipe as text
        </button>
        <a
          href={emailHref}
          onClick={() => setOpen(false)}
          className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-md text-sm text-foreground hover:bg-accent/10 transition-colors"
        >
          <Mail className="w-4 h-4 text-primary" />
          Email recipe
        </a>
        <button
          onClick={() => copy(text, 'Recipe')}
          className="hidden"
          aria-hidden
        >
          <Copy />
        </button>
      </PopoverContent>
    </Popover>
  );
}
