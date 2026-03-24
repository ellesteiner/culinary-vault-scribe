
-- Add user_id to recipe_comments
ALTER TABLE public.recipe_comments
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix comment policies: restrict UPDATE/DELETE to owner
DROP POLICY IF EXISTS "Authenticated users can update comments" ON public.recipe_comments;
DROP POLICY IF EXISTS "Authenticated users can delete comments" ON public.recipe_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.recipe_comments;

CREATE POLICY "Authenticated users can create comments"
  ON public.recipe_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON public.recipe_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.recipe_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix recipe_likes: restrict INSERT to authenticated only
-- (anonymous likes go through edge function with service role key, bypassing RLS)
DROP POLICY IF EXISTS "Users can insert likes" ON public.recipe_likes;

CREATE POLICY "Authenticated users can insert likes"
  ON public.recipe_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
