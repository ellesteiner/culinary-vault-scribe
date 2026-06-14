DROP POLICY IF EXISTS "Admins can create tags" ON public.tags;
CREATE POLICY "Authenticated users can create tags"
  ON public.tags
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
GRANT INSERT ON public.tags TO authenticated;