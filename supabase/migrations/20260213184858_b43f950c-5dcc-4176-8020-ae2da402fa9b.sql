
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile (for trigger)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add user_id and owner_name to recipes
ALTER TABLE public.recipes
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN owner_name TEXT;

-- Drop existing RLS policies on recipes
DROP POLICY IF EXISTS "Anyone can create recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can delete recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can update recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can view recipes" ON public.recipes;

-- New RLS policies for recipes
CREATE POLICY "Anyone can view recipes"
  ON public.recipes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create recipes"
  ON public.recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes"
  ON public.recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes"
  ON public.recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update recipe_tags policies to match recipe ownership
DROP POLICY IF EXISTS "Anyone can create recipe_tags" ON public.recipe_tags;
DROP POLICY IF EXISTS "Anyone can delete recipe_tags" ON public.recipe_tags;

CREATE POLICY "Authenticated users can create recipe_tags"
  ON public.recipe_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE id = recipe_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own recipe_tags"
  ON public.recipe_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE id = recipe_id AND user_id = auth.uid()
    )
  );
