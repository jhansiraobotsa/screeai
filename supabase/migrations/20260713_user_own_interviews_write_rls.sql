-- Let a logged-in user WRITE completion data for interviews matching their own
-- email (candidate.email == auth email). Complements the SELECT policies in
-- 20260713_user_own_interviews_rls.sql. Without these, an invited candidate can
-- run the interview but the "status = completed", scores, and transcript writes
-- are silently rejected by RLS, so the interview reverts to "created" on reopen.

-- Helper: interview ids whose candidate email == the caller's auth email.
CREATE OR REPLACE FUNCTION public.interview_ids_for_my_email()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id
  FROM public.interviews i
  JOIN public.candidates c ON c.id = i.candidate_id
  WHERE lower(c.email) = lower((auth.jwt() ->> 'email'));
$$;

-- 1. interviews: allow the invited user to update their own interview
DROP POLICY IF EXISTS "Users can update interviews matching their email" ON public.interviews;
CREATE POLICY "Users can update interviews matching their email" ON public.interviews
  FOR UPDATE TO authenticated
  USING (id IN (SELECT public.interview_ids_for_my_email()))
  WITH CHECK (id IN (SELECT public.interview_ids_for_my_email()));

-- 2. scores: allow insert + select for their own interview
DROP POLICY IF EXISTS "Users can insert scores for their interviews" ON public.scores;
CREATE POLICY "Users can insert scores for their interviews" ON public.scores
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (SELECT public.interview_ids_for_my_email()));

DROP POLICY IF EXISTS "Users can view scores for their interviews" ON public.scores;
CREATE POLICY "Users can view scores for their interviews" ON public.scores
  FOR SELECT TO authenticated
  USING (interview_id IN (SELECT public.interview_ids_for_my_email()));

-- 3. transcript_events: allow insert + select for their own interview
DROP POLICY IF EXISTS "Users can insert transcripts for their interviews" ON public.transcript_events;
CREATE POLICY "Users can insert transcripts for their interviews" ON public.transcript_events
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (SELECT public.interview_ids_for_my_email()));

DROP POLICY IF EXISTS "Users can view transcripts for their interviews" ON public.transcript_events;
CREATE POLICY "Users can view transcripts for their interviews" ON public.transcript_events
  FOR SELECT TO authenticated
  USING (interview_id IN (SELECT public.interview_ids_for_my_email()));

-- 4. ai_turns: allow insert + select for their own interview
DROP POLICY IF EXISTS "Users can insert ai_turns for their interviews" ON public.ai_turns;
CREATE POLICY "Users can insert ai_turns for their interviews" ON public.ai_turns
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (SELECT public.interview_ids_for_my_email()));

DROP POLICY IF EXISTS "Users can view ai_turns for their interviews" ON public.ai_turns;
CREATE POLICY "Users can view ai_turns for their interviews" ON public.ai_turns
  FOR SELECT TO authenticated
  USING (interview_id IN (SELECT public.interview_ids_for_my_email()));