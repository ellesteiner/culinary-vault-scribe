-- Fix the has_role SECURITY DEFINER function to prevent admin role enumeration.
-- The old function accepted an arbitrary _user_id parameter, allowing any authenticated
-- user to enumerate which user IDs have admin privileges. The new function ignores
-- the _user_id parameter and always uses auth.uid() internally, while keeping the
-- same signature for backward compatibility with existing RLS policies.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- Fix overly permissive tags INSERT policy: replace "any authenticated user" with admin-only.
-- This prevents tag-spam/abuse since only admins should curate the tag taxonomy.
DROP POLICY IF EXISTS "Authenticated users can create tags" ON public.tags;
CREATE POLICY "Admins can create tags"
ON public.tags
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));