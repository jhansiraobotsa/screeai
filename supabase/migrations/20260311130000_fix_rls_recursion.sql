-- Fix infinite recursion in RLS policies by using a security definer
-- function that bypasses RLS when checking org_id

-- Helper function: returns the org_id of the current user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ----------------------------------------------------------------
-- Drop all recursive policies and replace them
-- ----------------------------------------------------------------

-- PROFILES
DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

CREATE POLICY "Users can view profiles in their org" ON public.profiles
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id() OR user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ORGANIZATIONS
DROP POLICY IF EXISTS "Org members can view org" ON public.organizations;
DROP POLICY IF EXISTS "Admins can manage orgs" ON public.organizations;

CREATE POLICY "Org members can view org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_my_org_id());

CREATE POLICY "Admins can manage orgs" ON public.organizations
  FOR ALL TO authenticated
  USING (id = public.get_my_org_id());

-- CANDIDATES
DROP POLICY IF EXISTS "Org members can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Interviewers can manage candidates" ON public.candidates;

CREATE POLICY "Org members can view candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can manage candidates" ON public.candidates
  FOR ALL TO authenticated
  USING (org_id = public.get_my_org_id());

-- QUESTION PACKS
DROP POLICY IF EXISTS "Org members can view question packs" ON public.question_packs;
DROP POLICY IF EXISTS "Interviewers can manage question packs" ON public.question_packs;

CREATE POLICY "Org members can view question packs" ON public.question_packs
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can manage question packs" ON public.question_packs
  FOR ALL TO authenticated
  USING (org_id = public.get_my_org_id());

-- INTERVIEWS
DROP POLICY IF EXISTS "Org members can view interviews" ON public.interviews;
DROP POLICY IF EXISTS "Interviewers can manage interviews" ON public.interviews;

CREATE POLICY "Org members can view interviews" ON public.interviews
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can manage interviews" ON public.interviews
  FOR ALL TO authenticated
  USING (org_id = public.get_my_org_id());

-- TRANSCRIPT EVENTS
DROP POLICY IF EXISTS "Interview participants can view transcripts" ON public.transcript_events;
DROP POLICY IF EXISTS "Authenticated users can insert transcripts for their interviews" ON public.transcript_events;

CREATE POLICY "Interview participants can view transcripts" ON public.transcript_events
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

CREATE POLICY "Authenticated users can insert transcripts for their interviews" ON public.transcript_events
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

-- AI TURNS
DROP POLICY IF EXISTS "Interview participants can view AI turns" ON public.ai_turns;
DROP POLICY IF EXISTS "Authenticated users can insert AI turns for their interviews" ON public.ai_turns;

CREATE POLICY "Interview participants can view AI turns" ON public.ai_turns
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

CREATE POLICY "Authenticated users can insert AI turns for their interviews" ON public.ai_turns
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

-- SCORES
DROP POLICY IF EXISTS "Interview participants can view scores" ON public.scores;
DROP POLICY IF EXISTS "Authenticated users can insert scores for their interviews" ON public.scores;

CREATE POLICY "Interview participants can view scores" ON public.scores
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

CREATE POLICY "Authenticated users can insert scores for their interviews" ON public.scores
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

-- USER ROLES
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (user_id = auth.uid());
