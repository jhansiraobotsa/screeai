-- Final RLS fix: correct INSERT policies + performance index

-- Ensure index on profiles.user_id for fast get_my_org_id() lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_org_id ON public.interviews(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_org_id ON public.candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_transcript_events_interview_id ON public.transcript_events(interview_id);
CREATE INDEX IF NOT EXISTS idx_ai_turns_interview_id ON public.ai_turns(interview_id);
CREATE INDEX IF NOT EXISTS idx_scores_interview_id ON public.scores(interview_id);

-- ----------------------------------------------------------------
-- ORGANIZATIONS — fix INSERT (FOR ALL with USING blocks inserts)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view org" ON public.organizations;
DROP POLICY IF EXISTS "Admins can manage orgs" ON public.organizations;

CREATE POLICY "Org members can view org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_my_org_id());

CREATE POLICY "Authenticated users can create org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Org members can update org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.get_my_org_id())
  WITH CHECK (id = public.get_my_org_id());

CREATE POLICY "Org members can delete org" ON public.organizations
  FOR DELETE TO authenticated
  USING (id = public.get_my_org_id());

-- ----------------------------------------------------------------
-- CANDIDATES — explicit INSERT WITH CHECK
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Interviewers can manage candidates" ON public.candidates;

CREATE POLICY "Org members can view candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can insert candidates" ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can update candidates" ON public.candidates
  FOR UPDATE TO authenticated
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can delete candidates" ON public.candidates
  FOR DELETE TO authenticated
  USING (org_id = public.get_my_org_id());

-- ----------------------------------------------------------------
-- QUESTION PACKS — explicit INSERT WITH CHECK
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view question packs" ON public.question_packs;
DROP POLICY IF EXISTS "Interviewers can manage question packs" ON public.question_packs;

CREATE POLICY "Org members can view question packs" ON public.question_packs
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can insert question packs" ON public.question_packs
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can update question packs" ON public.question_packs
  FOR UPDATE TO authenticated
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can delete question packs" ON public.question_packs
  FOR DELETE TO authenticated
  USING (org_id = public.get_my_org_id());

-- ----------------------------------------------------------------
-- INTERVIEWS — explicit INSERT WITH CHECK
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view interviews" ON public.interviews;
DROP POLICY IF EXISTS "Interviewers can manage interviews" ON public.interviews;

CREATE POLICY "Org members can view interviews" ON public.interviews
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can insert interviews" ON public.interviews
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can update interviews" ON public.interviews
  FOR UPDATE TO authenticated
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "Interviewers can delete interviews" ON public.interviews
  FOR DELETE TO authenticated
  USING (org_id = public.get_my_org_id());

-- ----------------------------------------------------------------
-- TRANSCRIPT EVENTS — fix INSERT
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Interview participants can view transcripts" ON public.transcript_events;
DROP POLICY IF EXISTS "Authenticated users can insert transcripts for their interviews" ON public.transcript_events;

CREATE POLICY "Interview participants can view transcripts" ON public.transcript_events
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

CREATE POLICY "Authenticated users can insert transcripts" ON public.transcript_events
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

-- ----------------------------------------------------------------
-- AI TURNS — fix INSERT
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Interview participants can view AI turns" ON public.ai_turns;
DROP POLICY IF EXISTS "Authenticated users can insert AI turns for their interviews" ON public.ai_turns;

CREATE POLICY "Interview participants can view AI turns" ON public.ai_turns
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

CREATE POLICY "Authenticated users can insert AI turns" ON public.ai_turns
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

-- ----------------------------------------------------------------
-- SCORES — fix INSERT
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Interview participants can view scores" ON public.scores;
DROP POLICY IF EXISTS "Authenticated users can insert scores for their interviews" ON public.scores;

CREATE POLICY "Interview participants can view scores" ON public.scores
  FOR SELECT TO authenticated
  USING (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));

CREATE POLICY "Authenticated users can insert scores" ON public.scores
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews WHERE org_id = public.get_my_org_id()
  ));
