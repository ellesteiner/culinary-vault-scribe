
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles: authenticated users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- Create recipe_likes table
CREATE TABLE public.recipe_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  location_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recipe_likes ENABLE ROW LEVEL SECURITY;

-- Unique constraint: one like per user per recipe (for logged-in users)
CREATE UNIQUE INDEX idx_recipe_likes_user ON public.recipe_likes (recipe_id, user_id) WHERE user_id IS NOT NULL;
-- Unique constraint: one like per IP per recipe (for anonymous users)
CREATE UNIQUE INDEX idx_recipe_likes_ip ON public.recipe_likes (recipe_id, ip_address) WHERE user_id IS NULL AND ip_address IS NOT NULL;

-- RLS policies for recipe_likes
-- Anyone can insert likes
CREATE POLICY "Anyone can insert likes" ON public.recipe_likes
FOR INSERT WITH CHECK (true);

-- Anyone can read likes (but we'll filter location_data in the query/edge function)
CREATE POLICY "Anyone can read likes" ON public.recipe_likes
FOR SELECT USING (true);

-- Users can delete their own likes
CREATE POLICY "Users can delete own likes" ON public.recipe_likes
FOR DELETE USING (auth.uid() = user_id);
