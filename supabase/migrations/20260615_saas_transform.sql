-- Screen.ai SaaS Transform Migration
-- Adds user role, mock_sessions, email_invitations, and updated RLS

-- 1. Add 'user' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- 2. Create mock_sessions table
CREATE TABLE public.mock_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id),

  -- Input materials
  resume_url TEXT,
  resume_text TEXT,
  job_description TEXT NOT NULL,
  job_title TEXT,

  -- AI-generated questions (exactly 10)
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  -- Statuses: pending, questions_generated, scheduled, live, completed, cancelled

  -- Link to actual interview when created
  interview_id UUID REFERENCES public.interviews(id),

  -- Admin scheduling
  created_by UUID REFERENCES auth.users(id),
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invite_email_sent BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mock_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_mock_sessions_updated_at
  BEFORE UPDATE ON public.mock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create email_invitations table
CREATE TABLE public.email_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mock_session_id UUID REFERENCES public.mock_sessions(id) ON DELETE CASCADE NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_by UUID REFERENCES auth.users(id) NOT NULL,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_invitations ENABLE ROW LEVEL SECURITY;

-- 4. Add mock_session_id to interviews table
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS mock_session_id UUID REFERENCES public.mock_sessions(id);

-- 5. Update handle_new_user trigger: default role -> 'user', auto-create personal org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create a personal org for the user
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, full_name, org_id)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', new_org_id);

  -- Default role: user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

-- 6. RLS Policies for mock_sessions

-- Users see their own sessions
CREATE POLICY "Users can view own mock sessions" ON public.mock_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own mock sessions" ON public.mock_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own mock sessions" ON public.mock_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- RLS for email_invitations
CREATE POLICY "Admins can manage email invitations" ON public.email_invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own invitations" ON public.email_invitations
  FOR SELECT TO authenticated
  USING (mock_session_id IN (
    SELECT id FROM public.mock_sessions WHERE user_id = auth.uid()
  ));

-- Users can view interviews linked to their mock sessions
CREATE POLICY "Users can view own mock interviews" ON public.interviews
  FOR SELECT TO authenticated
  USING (
    mock_session_id IN (SELECT id FROM public.mock_sessions WHERE user_id = auth.uid())
  );

-- Users can manage (update) interviews linked to their mock sessions
CREATE POLICY "Users can update own mock interviews" ON public.interviews
  FOR UPDATE TO authenticated
  USING (
    mock_session_id IN (SELECT id FROM public.mock_sessions WHERE user_id = auth.uid())
  );

-- Transcript events for user-owned mock interviews
CREATE POLICY "Users can view transcripts for own mock interviews" ON public.transcript_events
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT i.id FROM public.interviews i
    JOIN public.mock_sessions ms ON ms.interview_id = i.id
    WHERE ms.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert transcripts for own mock interviews" ON public.transcript_events
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT i.id FROM public.interviews i
    JOIN public.mock_sessions ms ON ms.interview_id = i.id
    WHERE ms.user_id = auth.uid()
  ));

-- AI turns for user-owned mock interviews
CREATE POLICY "Users can view ai_turns for own mock interviews" ON public.ai_turns
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT i.id FROM public.interviews i
    JOIN public.mock_sessions ms ON ms.interview_id = i.id
    WHERE ms.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert ai_turns for own mock interviews" ON public.ai_turns
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT i.id FROM public.interviews i
    JOIN public.mock_sessions ms ON ms.interview_id = i.id
    WHERE ms.user_id = auth.uid()
  ));

-- Scores for user-owned mock interviews
CREATE POLICY "Users can view scores for own mock interviews" ON public.scores
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT i.id FROM public.interviews i
    JOIN public.mock_sessions ms ON ms.interview_id = i.id
    WHERE ms.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert scores for own mock interviews" ON public.scores
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT i.id FROM public.interviews i
    JOIN public.mock_sessions ms ON ms.interview_id = i.id
    WHERE ms.user_id = auth.uid()
  ));

-- Enable realtime for mock_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.mock_sessions;
