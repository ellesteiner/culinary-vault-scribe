-- Fix recipe_comments: require authentication for INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Anyone can create comments" ON public.recipe_comments;
DROP POLICY IF EXISTS "Anyone can delete comments" ON public.recipe_comments;
DROP POLICY IF EXISTS "Anyone can update comments" ON public.recipe_comments;

CREATE POLICY "Authenticated users can create comments"
  ON public.recipe_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update comments"
  ON public.recipe_comments FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete comments"
  ON public.recipe_comments FOR DELETE
  TO authenticated
  USING (true);

-- Fix recipe_likes: restrict INSERT to prevent wide-open access
DROP POLICY IF EXISTS "Anyone can insert likes" ON public.recipe_likes;

CREATE POLICY "Users can insert likes"
  ON public.recipe_likes FOR INSERT
  TO public
  WITH CHECK (
    (user_id = auth.uid()) OR 
    (user_id IS NULL AND ip_address IS NOT NULL)
  );

-- Fix tags: require authentication for INSERT
DROP POLICY IF EXISTS "Anyone can create tags" ON public.tags;

CREATE POLICY "Authenticated users can create tags"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (true);