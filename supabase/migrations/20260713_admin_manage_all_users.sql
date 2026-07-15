-- Let admins see and manage ALL users across the app (not just their own org).
-- profiles + user_roles are normally org-scoped / self-scoped; these additive
-- policies grant admins global read on profiles and full manage on user_roles.

-- Admins can read every profile
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can read every role row (user_roles already restricts manage to admins,
-- but SELECT was limited to own rows; this lets the admin panel list everyone's role)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));