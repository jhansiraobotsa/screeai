
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'interviewer', 'candidate');

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table as required)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Candidates
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  resume_text TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Question packs
CREATE TABLE public.question_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  role_target TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.question_packs ENABLE ROW LEVEL SECURITY;

-- Interviews
CREATE TABLE public.interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) NOT NULL,
  question_pack_id UUID REFERENCES public.question_packs(id),
  interviewer_id UUID REFERENCES auth.users(id),
  room_id TEXT,
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'created',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Transcript events
CREATE TABLE public.transcript_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT false,
  sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transcript_events ENABLE ROW LEVEL SECURITY;

-- AI turns
CREATE TABLE public.ai_turns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  prompt TEXT NOT NULL,
  model_output JSONB,
  tts_audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_turns ENABLE ROW LEVEL SECURITY;

-- Scores
CREATE TABLE public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  dimension TEXT NOT NULL,
  score NUMERIC NOT NULL,
  evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_question_packs_updated_at BEFORE UPDATE ON public.question_packs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default role: interviewer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'interviewer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: users can read all in their org, update own
CREATE POLICY "Users can view profiles in their org" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User roles: users can read their own, admins can manage
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Organizations: members can read
CREATE POLICY "Org members can view org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage orgs" ON public.organizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Candidates: org members can view
CREATE POLICY "Org members can view candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Interviewers can manage candidates" ON public.candidates
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));

-- Question packs: org members can view
CREATE POLICY "Org members can view question packs" ON public.question_packs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Interviewers can manage question packs" ON public.question_packs
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));

-- Interviews: org members can view, interviewers can manage
CREATE POLICY "Org members can view interviews" ON public.interviews
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Interviewers can manage interviews" ON public.interviews
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));

-- Transcript events: accessible via interview access
CREATE POLICY "Interview participants can view transcripts" ON public.transcript_events
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews
    WHERE org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  ));
CREATE POLICY "System can insert transcripts" ON public.transcript_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- AI turns: accessible via interview
CREATE POLICY "Interview participants can view AI turns" ON public.ai_turns
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews
    WHERE org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  ));
CREATE POLICY "System can insert AI turns" ON public.ai_turns
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Scores: accessible via interview
CREATE POLICY "Interview participants can view scores" ON public.scores
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews
    WHERE org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  ));
CREATE POLICY "System can insert scores" ON public.scores
  FOR INSERT TO authenticated
  WITH CHECK (true);
