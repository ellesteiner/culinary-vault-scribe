import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DynamicListProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  label: string;
  multiline?: boolean;
}

export function DynamicList({ 
  items, 
  onChange, 
  placeholder = 'Add item...', 
  label,
  multiline = false 
}: DynamicListProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const addItem = () => {
    onChange([...items, '']);
    setTimeout(() => {
      setFocusedIndex(items.length);
    }, 50);
  };

  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      onChange(['']);
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey && !multiline) {
      e.preventDefault();
      addItem();
    }
    if (e.key === 'Backspace' && items[index] === '' && items.length > 1) {
      e.preventDefault();
      removeItem(index);
      setFocusedIndex(Math.max(0, index - 1));
    }
  };

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-xs text-muted-foreground">
          {items.filter(Boolean).length} items
        </span>
      </div>

      <Reorder.Group 
        axis="y" 
        values={items} 
        onReorder={onChange}
        className="space-y-2"
      >
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <Reorder.Item
              key={`${index}-${items.length}`}
              value={item}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="group"
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  className="mt-3 cursor-grab text-muted-foreground/50 hover:text-muted-foreground transition-colors active:cursor-grabbing"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-3 text-xs font-medium text-muted-foreground/60 select-none">
                    {index + 1}.
                  </span>
                  <InputComponent
                    value={item}
                    onChange={(e) => updateItem(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    placeholder={placeholder}
                    className={cn(
                      "pl-9 input-cookbook",
                      multiline && "min-h-[80px] resize-none"
                    )}
                    autoFocus={focusedIndex === index}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className={cn(
                    "mt-3 p-1 text-muted-foreground/50 hover:text-destructive transition-colors",
                    "opacity-0 group-hover:opacity-100 focus:opacity-100"
                  )}
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full border-dashed hover:border-primary hover:text-primary"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add {label.toLowerCase().replace(/s$/, '')}
      </Button>
    </div>
  );
}
