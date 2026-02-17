
-- Fix 1: Restrict profiles to owner-only
DROP POLICY "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Fix 2: Restrict recipe_likes - remove public read, add admin + owner policies
DROP POLICY "Anyone can read likes" ON public.recipe_likes;

CREATE POLICY "Users can read own likes" ON public.recipe_likes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all likes" ON public.recipe_likes
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create RPC for public like counts (no sensitive data exposed)
CREATE OR REPLACE FUNCTION public.get_recipe_like_counts()
RETURNS TABLE(recipe_id uuid, like_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT recipe_id, COUNT(*) as like_count
  FROM public.recipe_likes
  GROUP BY recipe_id;
$$;
