import { motion } from 'framer-motion';
import { Plus, BookOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HeaderProps {
  onAddRecipe: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  recipeCount: number;
}

export function Header({ onAddRecipe, searchQuery, onSearchChange, recipeCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Logo & Title */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                My Cookbook
              </h1>
              <p className="text-sm text-muted-foreground">
                {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
              </p>
            </div>
          </motion.div>

          {/* Search & Add */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search recipes..."
                className="pl-10 w-64 input-cookbook"
              />
            </div>
            <Button
              onClick={onAddRecipe}
              className="btn-cookbook gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Recipe</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
