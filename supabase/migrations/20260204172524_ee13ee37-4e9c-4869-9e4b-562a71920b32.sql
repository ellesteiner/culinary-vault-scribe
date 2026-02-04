-- Create comments table for recipes
CREATE TABLE public.recipe_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipe_comments ENABLE ROW LEVEL SECURITY;

-- Create policies (matching existing pattern - anyone can CRUD)
CREATE POLICY "Anyone can view comments" 
ON public.recipe_comments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create comments" 
ON public.recipe_comments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update comments" 
ON public.recipe_comments 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete comments" 
ON public.recipe_comments 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_recipe_comments_updated_at
BEFORE UPDATE ON public.recipe_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();