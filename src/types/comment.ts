export interface RecipeComment {
  id: string;
  recipe_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}
