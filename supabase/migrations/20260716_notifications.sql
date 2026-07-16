-- In-app notifications. Each notification targets a user by email (matches how
-- app users are identified across the app).

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id),
  recipient_email TEXT NOT NULL,           -- lowercased
  type TEXT NOT NULL,                       -- interview_invited | job_published | status_changed | interview_completed
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                                -- in-app path to open when clicked
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(lower(recipient_email), read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- A user can read + update (mark read) their own notifications, matched by email.
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (lower(recipient_email) = lower((auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (lower(recipient_email) = lower((auth.jwt() ->> 'email')))
  WITH CHECK (lower(recipient_email) = lower((auth.jwt() ->> 'email')));

-- Server (anon key) creates notifications via a SECURITY DEFINER RPC so it can
-- write past RLS without a broad insert policy.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_org_id UUID,
  p_recipient_email TEXT,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (org_id, recipient_email, type, title, body, link)
  VALUES (p_org_id, lower(p_recipient_email), p_type, p_title, p_body, p_link);
$$;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Broadcast a notification to all non-admin users in an org (for job_published).
CREATE OR REPLACE FUNCTION public.notify_org_users(
  p_org_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  INSERT INTO public.notifications (org_id, recipient_email, type, title, body, link)
  SELECT p_org_id, lower(u.email), p_type, p_title, p_body, p_link
  FROM public.profiles pr
  JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.org_id = p_org_id
    AND NOT public.has_role(pr.user_id, 'admin');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_org_users(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Emails of all admins in an org (used to notify admins of interview completion).
CREATE OR REPLACE FUNCTION public.org_admin_emails(p_org_id UUID)
RETURNS TABLE (email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM public.profiles pr
  JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.org_id = p_org_id
    AND public.has_role(pr.user_id, 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.org_admin_emails(UUID) TO anon, authenticated;