import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/recipe/Header';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { RecipeModal } from '@/components/recipe/RecipeModal';
import { DeleteConfirmDialog } from '@/components/recipe/DeleteConfirmDialog';
import { useRecipes, useDeleteRecipe } from '@/hooks/useRecipes';
import { RecipeWithTags } from '@/types/recipe';

const Index = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithTags | null>(null);
  const [deleteRecipeId, setDeleteRecipeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: recipes = [], isLoading } = useRecipes();
  const deleteRecipe = useDeleteRecipe();

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    
    const query = searchQuery.toLowerCase();
    return recipes.filter((recipe) =>
      recipe.title.toLowerCase().includes(query) ||
      recipe.ingredients.some((ing) => ing.toLowerCase().includes(query)) ||
      recipe.tags.some((tag) => tag.name.toLowerCase().includes(query))
    );
  }, [recipes, searchQuery]);

  const handleAddRecipe = () => {
    setEditingRecipe(null);
    setIsModalOpen(true);
  };

  const handleEditRecipe = (recipe: RecipeWithTags) => {
    setEditingRecipe(recipe);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteRecipeId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteRecipeId) {
      deleteRecipe.mutate(deleteRecipeId);
      setDeleteRecipeId(null);
    }
  };

  const recipeToDelete = recipes.find((r) => r.id === deleteRecipeId);

  return (
    <div className="min-h-screen bg-background gradient-cookbook paper-texture">
      <Header
        onAddRecipe={handleAddRecipe}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        recipeCount={recipes.length}
      />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <RecipeGrid
            recipes={filteredRecipes}
            onEdit={handleEditRecipe}
            onDelete={handleDeleteClick}
            isLoading={isLoading}
          />
        </motion.div>
      </main>

      {/* Add/Edit Modal */}
      <RecipeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecipe(null);
        }}
        recipe={editingRecipe}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!deleteRecipeId}
        onClose={() => setDeleteRecipeId(null)}
        onConfirm={handleConfirmDelete}
        recipeName={recipeToDelete?.title}
      />
    </div>
  );
};

export default Index;
