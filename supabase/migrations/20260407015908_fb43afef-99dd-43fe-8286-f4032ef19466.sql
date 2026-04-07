CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  full_name_val TEXT;
BEGIN
  full_name_val := LEFT(
    TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')),
    200
  );
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), full_name_val);
  RETURN NEW;
END;
$$;