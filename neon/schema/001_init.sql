-- Culinary Vault Scribe: Neon schema (public schema only).
-- Stripped from the Supabase backup: no RLS, no GRANT/owner statements, no
-- auth-schema references. Authorization now lives in the API layer, not here.
-- `has_role()` (old: used auth.uid() inside RLS policies) and `handle_new_user()`
-- (old: trigger on auth.users) are intentionally not ported — their logic is
-- reimplemented in the API layer against Neon Auth.

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    source_url text,
    image_url text,
    ingredients jsonb DEFAULT '[]'::jsonb,
    instructions jsonb DEFAULT '[]'::jsonb,
    notes text,
    cook_time text,
    prep_time text,
    servings text,
    user_id uuid,
    owner_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tags_pkey PRIMARY KEY (id),
    CONSTRAINT tags_name_key UNIQUE (name)
);

CREATE TABLE public.recipe_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_tags_pkey PRIMARY KEY (id),
    CONSTRAINT recipe_tags_recipe_id_tag_id_key UNIQUE (recipe_id, tag_id),
    CONSTRAINT recipe_tags_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE,
    CONSTRAINT recipe_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE
);

CREATE TABLE public.recipe_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    user_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_comments_pkey PRIMARY KEY (id),
    CONSTRAINT recipe_comments_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE
);

CREATE TABLE public.recipe_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    user_id uuid,
    ip_address text,
    location_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_likes_pkey PRIMARY KEY (id),
    CONSTRAINT recipe_likes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE
);

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_roles_pkey PRIMARY KEY (id),
    CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- Used via RPC from useLikes.ts; kept as a plain function, no SECURITY DEFINER
-- needed now that there's no RLS to bypass.
CREATE FUNCTION public.get_recipe_like_counts() RETURNS TABLE(recipe_id uuid, like_count bigint)
    LANGUAGE sql STABLE
    AS $$
  SELECT recipe_id, COUNT(*) as like_count
  FROM public.recipe_likes
  GROUP BY recipe_id;
$$;
