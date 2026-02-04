export interface Recipe {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  source_url: string | null;
  image_url: string | null;
  ingredients: string[];
  instructions: string[];
  notes: string | null;
  cook_time: string | null;
  prep_time: string | null;
  servings: string | null;
}

export interface Tag {
  id: string;
  name: string;
  created_at: string;
}

export interface RecipeTag {
  id: string;
  recipe_id: string;
  tag_id: string;
  created_at: string;
}

export interface RecipeWithTags extends Recipe {
  tags: Tag[];
}

export interface RecipeFormData {
  title: string;
  source_url: string;
  image_url: string;
  ingredients: string[];
  instructions: string[];
  notes: string;
  cook_time: string;
  prep_time: string;
  servings: string;
  tagIds: string[];
}

export const defaultRecipeFormData: RecipeFormData = {
  title: '',
  source_url: '',
  image_url: '',
  ingredients: [''],
  instructions: [''],
  notes: '',
  cook_time: '',
  prep_time: '',
  servings: '',
  tagIds: [],
};
