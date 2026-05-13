-- Restrict SECURITY DEFINER functions to prevent unauthorized direct execution.
-- These functions are used internally (RLS policies, triggers) and should not be
-- callable by anonymous users or directly by the public.

-- 1. has_role: Used inside RLS policies. Must be callable by authenticated users
--    (policy evaluation engine runs as the authenticated user), but NOT by anonymous users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 2. handle_new_user: A trigger function on auth.users. It should never be called directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- 3. get_recipe_like_counts: Returns aggregated like counts. The data is not sensitive
--    (just counts per recipe), but as a SECURITY DEFINER function it should not be
--    directly callable by anonymous users. Keep it accessible to authenticated users
--    since the app may call it for displaying like counts.
REVOKE EXECUTE ON FUNCTION public.get_recipe_like_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recipe_like_counts() TO authenticated;