
-- Allow admins to update/delete any recipe
DROP POLICY IF EXISTS "Users can update own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON public.recipes;

CREATE POLICY "Users or admins can update recipes"
ON public.recipes FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users or admins can delete recipes"
ON public.recipes FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Grant admin role to Elle (project owner) and claim ownership of orphan recipes
INSERT INTO public.user_roles (user_id, role)
VALUES ('c837d21b-6894-4716-8cc9-3fd13f00625a', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.recipes
SET user_id = 'c837d21b-6894-4716-8cc9-3fd13f00625a',
    owner_name = COALESCE(owner_name, 'Elle')
WHERE user_id IS NULL;
