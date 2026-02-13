import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/recipe/Header';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { RecipeModal } from '@/components/recipe/RecipeModal';
import { DeleteConfirmDialog } from '@/components/recipe/DeleteConfirmDialog';
import { TagFilter } from '@/components/recipe/TagFilter';
import { OwnerFilter } from '@/components/recipe/OwnerFilter';
import { useRecipes, useDeleteRecipe, useTags } from '@/hooks/useRecipes';
import { useLikeCounts, useUserLikes } from '@/hooks/useLikes';
import { RecipeWithTags } from '@/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Index = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithTags | null>(null);
  const [deleteRecipeId, setDeleteRecipeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [ownerNameFilter, setOwnerNameFilter] = useState('all');

  const { user } = useAuth();
  const { data: recipes = [], isLoading } = useRecipes();
  const { data: tags = [] } = useTags();
  const { data: likeCounts = {} } = useLikeCounts();
  const { data: userLikes = {} } = useUserLikes();
  const deleteRecipe = useDeleteRecipe();

  // Get unique owners
  const owners = useMemo(() => {
    const ownerMap = new Map<string, string>();
    recipes.forEach((r) => {
      if (r.user_id && r.owner_name) {
        ownerMap.set(r.user_id, r.owner_name);
      }
    });
    return Array.from(ownerMap, ([user_id, owner_name]) => ({ user_id, owner_name }));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    let result = recipes;

    // Filter by ownership
    if (ownerFilter === 'mine' && user) {
      result = result.filter((r) => r.user_id === user.id);
    }

    // Filter by specific owner
    if (ownerNameFilter !== 'all') {
      result = result.filter((r) => r.user_id === ownerNameFilter);
    }

    // Filter by selected tags
    if (selectedTagIds.length > 0) {
      result = result.filter((recipe) =>
        selectedTagIds.some((tagId) =>
          recipe.tags.some((tag) => tag.id === tagId)
        )
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((recipe) =>
        recipe.title.toLowerCase().includes(query) ||
        recipe.ingredients.some((ing) => ing.toLowerCase().includes(query)) ||
        recipe.tags.some((tag) => tag.name.toLowerCase().includes(query))
      );
    }

    return result;
  }, [recipes, searchQuery, selectedTagIds, ownerFilter, ownerNameFilter, user]);

  const handleAddRecipe = () => {
    if (!user) {
      toast.error('Please sign in to add a recipe');
      return;
    }
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
        {/* Filters row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          {tags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1"
            >
              <TagFilter
                tags={tags}
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
              />
            </motion.div>
          )}

          <OwnerFilter
            ownerFilter={ownerFilter}
            onOwnerFilterChange={setOwnerFilter}
            ownerNameFilter={ownerNameFilter}
            onOwnerNameFilterChange={setOwnerNameFilter}
            owners={owners}
          />
        </div>

        {/* Results info when filtering */}
        {(selectedTagIds.length > 0 || searchQuery || ownerFilter !== 'all' || ownerNameFilter !== 'all') && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground mb-4"
          >
            Showing {filteredRecipes.length} of {recipes.length} recipes
          </motion.p>
        )}

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
            likeCounts={likeCounts}
            userLikes={userLikes}
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
