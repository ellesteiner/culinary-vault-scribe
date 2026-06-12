-- Allow anonymous (signed-out) visitors to insert a like row, but only without a user_id.
CREATE POLICY "Anonymous users can insert likes"
ON public.recipe_likes
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

GRANT INSERT ON public.recipe_likes TO anon;