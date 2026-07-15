-- Fix handle_new_user to auto-create an organization on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create a personal organization for this user
  INSERT INTO public.organizations (name)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)) || '''s Organization'
  )
  RETURNING id INTO new_org_id;

  -- Create profile linked to the new org
  INSERT INTO public.profiles (user_id, full_name, org_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    new_org_id
  );

  -- Default role: interviewer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'interviewer');

  RETURN NEW;
END;
$$;

-- Fix existing users who signed up before this migration (org_id is NULL)
DO $$
DECLARE
  rec RECORD;
  new_org_id UUID;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, p.user_id, p.full_name, u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.org_id IS NULL
  LOOP
    -- Create an org for them
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(rec.full_name, split_part(rec.email, '@', 1)) || '''s Organization')
    RETURNING id INTO new_org_id;

    -- Link their profile to the new org
    UPDATE public.profiles
    SET org_id = new_org_id
    WHERE id = rec.profile_id;
  END LOOP;
END;
$$;
