import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Users,
  ExternalLink,
  Edit3,
  ChefHat,
  CheckCircle2,
  Circle,
  BookOpen,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useRecipe } from '@/hooks/useRecipe';
import { RecipeModal } from '@/components/recipe/RecipeModal';
import { RecipeComments } from '@/components/recipe/RecipeComments';
import { useAuth } from '@/contexts/AuthContext';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recipe, isLoading, error } = useRecipe(id);
  const { user } = useAuth();

  const [cookMode, setCookMode] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isOwner = user && recipe?.user_id === user.id;

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <ChefHat className="w-12 h-12 text-primary/50" />
          <p className="text-muted-foreground">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto" />
          <h2 className="font-serif text-2xl text-foreground">Recipe not found</h2>
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cookbook
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero Header */}
      <div className="relative">
        {recipe.image_url ? (
          <div className="h-64 md:h-80 lg:h-96 relative overflow-hidden">
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-48 md:h-64 bg-gradient-to-br from-primary/10 to-accent/10" />
        )}

        {/* Navigation Bar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="bg-white/95 backdrop-blur-sm hover:bg-white text-foreground border-border shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex gap-2">
            {recipe.source_url && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="bg-white/95 backdrop-blur-sm hover:bg-white text-foreground border-border shadow-sm"
              >
                <a href={recipe.source_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Source
                </a>
              </Button>
            )}
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="bg-white/95 backdrop-blur-sm hover:bg-white text-foreground border-border shadow-sm"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 -mt-56 relative z-10 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background rounded-2xl shadow-cookbook border border-border overflow-hidden"
        >
          {/* Title Section */}
          <div className="p-6 md:p-8 border-b border-border">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground mb-4">
              {recipe.title}
            </h1>

            {/* Owner */}
            {recipe.owner_name && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                <User className="w-4 h-4" />
                <span>by {recipe.owner_name}</span>
              </div>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
              {recipe.prep_time && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Prep: {recipe.prep_time}</span>
                </div>
              )}
              {recipe.cook_time && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Cook: {recipe.cook_time}</span>
                </div>
              )}
              {recipe.servings && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{recipe.servings}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipe.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Cook Mode Toggle */}
          <div className="px-6 md:px-8 py-4 bg-accent/5 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChefHat className="w-5 h-5 text-primary" />
                <span className="font-medium">Cook Mode</span>
                <span className="text-sm text-muted-foreground">
                  Check off ingredients and steps as you go
                </span>
              </div>
              <Button
                variant={cookMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCookMode(!cookMode)}
                className={cookMode ? 'btn-cookbook' : ''}
              >
                {cookMode ? 'Active' : 'Enable'}
              </Button>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-[320px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Ingredients Sidebar */}
            <div className="p-6 md:p-8">
              <h2 className="font-serif text-2xl text-foreground mb-6 flex items-center gap-2">
                <span>Ingredients</span>
                {cookMode && (
                  <span className="text-sm font-sans text-muted-foreground">
                    ({checkedIngredients.size}/{recipe.ingredients.length})
                  </span>
                )}
              </h2>

              <ul className="space-y-3">
                {recipe.ingredients.map((ingredient, index) => (
                  <motion.li
                    key={index}
                    initial={false}
                    animate={{
                      opacity: cookMode && checkedIngredients.has(index) ? 0.5 : 1,
                    }}
                    className="flex items-start gap-3"
                  >
                    {cookMode ? (
                      <Checkbox
                        checked={checkedIngredients.has(index)}
                        onCheckedChange={() => toggleIngredient(index)}
                        className="mt-0.5"
                      />
                    ) : (
                      <Circle className="w-2 h-2 mt-2 fill-primary text-primary shrink-0" />
                    )}
                    <span
                      className={
                        cookMode && checkedIngredients.has(index)
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }
                    >
                      {ingredient}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Instructions Main Body */}
            <div className="p-6 md:p-8">
              <h2 className="font-serif text-2xl text-foreground mb-6 flex items-center gap-2">
                <span>Instructions</span>
                {cookMode && (
                  <span className="text-sm font-sans text-muted-foreground">
                    ({checkedSteps.size}/{recipe.instructions.length})
                  </span>
                )}
              </h2>

              <ol className="space-y-6">
                {recipe.instructions.map((instruction, index) => (
                  <motion.li
                    key={index}
                    initial={false}
                    animate={{
                      opacity: cookMode && checkedSteps.has(index) ? 0.5 : 1,
                    }}
                    className="flex gap-4"
                  >
                    <button
                      onClick={() => cookMode && toggleStep(index)}
                      disabled={!cookMode}
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-serif text-lg transition-colors ${
                        cookMode && checkedSteps.has(index)
                          ? 'bg-primary text-primary-foreground'
                          : cookMode
                          ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {cookMode && checkedSteps.has(index) ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        index + 1
                      )}
                    </button>
                    <p
                      className={`text-lg leading-relaxed pt-1 ${
                        cookMode && checkedSteps.has(index)
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {instruction}
                    </p>
                  </motion.li>
                ))}
              </ol>

              {/* Notes */}
              {recipe.notes && (
                <div className="mt-8 pt-8 border-t border-border">
                  <h3 className="font-serif text-xl text-foreground mb-3">Notes</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{recipe.notes}</p>
                </div>
              )}

              {/* Comments */}
              <RecipeComments recipeId={recipe.id} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Edit Modal */}
      <RecipeModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        recipe={recipe}
      />
    </div>
  );
}
