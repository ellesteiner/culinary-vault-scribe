import { useCallback, useEffect, useState } from 'react';
import { categorizeIngredient, ShoppingCategory } from '@/lib/ingredientParser';

const STORAGE_KEY = 'cookbook-shopping-list-v1';

export interface ShoppingItem {
  id: string;
  text: string;
  category: ShoppingCategory;
  recipeId?: string;
  recipeTitle?: string;
  checked: boolean;
  addedAt: number;
}

function load(): ShoppingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: ShoppingItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

let memory: ShoppingItem[] = load();
const listeners = new Set<(items: ShoppingItem[]) => void>();

function setAll(next: ShoppingItem[]) {
  memory = next;
  save(memory);
  listeners.forEach((l) => l(memory));
}

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>(memory);

  useEffect(() => {
    const listener = (next: ShoppingItem[]) => setItems(next);
    listeners.add(listener);
    // Sync across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAll(load());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const addItems = useCallback(
    (
      ingredients: string[],
      recipe?: { id: string; title: string }
    ) => {
      const now = Date.now();
      const newItems: ShoppingItem[] = ingredients
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, i) => ({
          id: `${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          text,
          category: categorizeIngredient(text),
          recipeId: recipe?.id,
          recipeTitle: recipe?.title,
          checked: false,
          addedAt: now + i,
        }));
      setAll([...memory, ...newItems]);
      return newItems.length;
    },
    []
  );

  const toggleItem = useCallback((id: string) => {
    setAll(memory.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setAll(memory.filter((it) => it.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setAll(memory.filter((it) => !it.checked));
  }, []);

  const clearAll = useCallback(() => {
    setAll([]);
  }, []);

  return { items, addItems, toggleItem, removeItem, clearCompleted, clearAll };
}
