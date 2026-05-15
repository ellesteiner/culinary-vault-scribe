import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Printer, Share2, ShoppingBasket, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useShoppingList, ShoppingItem } from '@/hooks/useShoppingList';
import { ShoppingCategory } from '@/lib/ingredientParser';
import { toast } from 'sonner';

const CATEGORY_ORDER: ShoppingCategory[] = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Spices',
  'Frozen',
  'Beverages',
  'Other',
];

function buildPlainText(items: ShoppingItem[]): string {
  if (items.length === 0) return 'Shopping list is empty.';
  const grouped: Record<string, ShoppingItem[]> = {};
  for (const it of items) {
    if (it.checked) continue;
    (grouped[it.category] ||= []).push(it);
  }
  const lines: string[] = ['Shopping List', ''];
  for (const cat of CATEGORY_ORDER) {
    const group = grouped[cat];
    if (!group?.length) continue;
    lines.push(cat.toUpperCase());
    for (const it of group) lines.push(`- ${it.text}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export default function ShoppingList() {
  const navigate = useNavigate();
  const { items, toggleItem, removeItem, clearCompleted, clearAll } = useShoppingList();
  const [confirmClear, setConfirmClear] = useState(false);

  const { active, completed } = useMemo(() => {
    const active: Record<string, ShoppingItem[]> = {};
    const completed: ShoppingItem[] = [];
    for (const it of items) {
      if (it.checked) completed.push(it);
      else (active[it.category] ||= []).push(it);
    }
    return { active, completed };
  }, [items]);

  const totalActive = items.filter((i) => !i.checked).length;

  const handleShare = async () => {
    const text = buildPlainText(items);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Shopping List', text });
        return;
      }
    } catch {
      /* user cancelled */
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Shopping list copied to clipboard');
    } catch {
      toast.error('Could not copy list');
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background gradient-cookbook paper-texture">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-11 w-11"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <ShoppingBasket className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  Shopping List
                </h1>
                <p className="text-sm text-muted-foreground">
                  {totalActive} {totalActive === 1 ? 'item' : 'items'} to buy
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrint}
              className="h-11 w-11"
              aria-label="Print"
            >
              <Printer className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="h-11 w-11"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBasket className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-serif text-2xl text-foreground mb-2">
              Your list is empty
            </h2>
            <p className="text-muted-foreground mb-6">
              Add ingredients from a recipe to get started.
            </p>
            <Button onClick={() => navigate('/')} className="btn-cookbook">
              Browse recipes
            </Button>
          </div>
        ) : (
          <>
            {/* Active groups */}
            <div className="space-y-6">
              {CATEGORY_ORDER.map((cat) => {
                const group = active[cat];
                if (!group?.length) return null;
                return (
                  <section
                    key={cat}
                    className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                  >
                    <h2 className="font-serif text-lg px-5 py-3 border-b border-border bg-muted/40">
                      {cat}
                      <span className="ml-2 text-sm text-muted-foreground font-sans">
                        ({group.length})
                      </span>
                    </h2>
                    <ul>
                      {group.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 px-5 py-3 border-b border-border last:border-0 min-h-[44px]"
                        >
                          <button
                            onClick={() => toggleItem(item.id)}
                            className="shrink-0 w-11 h-11 -ml-2 flex items-center justify-center rounded-md hover:bg-accent/10 print:hidden"
                            aria-label={`Mark ${item.text} as bought`}
                          >
                            <Checkbox checked={item.checked} className="pointer-events-none" />
                          </button>
                          <div className="flex-1 pt-2.5">
                            <p className="text-foreground">{item.text}</p>
                            {item.recipeTitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                from {item.recipeTitle}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="shrink-0 w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-destructive print:hidden"
                            aria-label={`Remove ${item.text}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            {/* Completed */}
            {completed.length > 0 && (
              <section className="mt-8 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <h2 className="font-serif text-lg px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
                  <Check className="w-4 h-4 text-secondary" />
                  Got it
                  <span className="ml-1 text-sm text-muted-foreground font-sans">
                    ({completed.length})
                  </span>
                </h2>
                <ul>
                  {completed.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 px-5 py-3 border-b border-border last:border-0 min-h-[44px]"
                    >
                      <button
                        onClick={() => toggleItem(item.id)}
                        className="shrink-0 w-11 h-11 -ml-2 flex items-center justify-center rounded-md hover:bg-accent/10 print:hidden"
                        aria-label={`Unmark ${item.text}`}
                      >
                        <Checkbox checked className="pointer-events-none" />
                      </button>
                      <div className="flex-1 pt-2.5">
                        <p className="text-muted-foreground line-through">{item.text}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-destructive print:hidden"
                        aria-label={`Remove ${item.text}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Footer actions */}
            <div className="mt-8 flex flex-wrap gap-3 print:hidden">
              {completed.length > 0 && (
                <Button variant="outline" onClick={clearCompleted} className="min-h-[44px]">
                  Clear completed ({completed.length})
                </Button>
              )}
              {confirmClear ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      clearAll();
                      setConfirmClear(false);
                      toast.success('Shopping list cleared');
                    }}
                    className="min-h-[44px]"
                  >
                    Confirm clear all
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmClear(false)} className="min-h-[44px]">
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[44px] text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear all
                </Button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
