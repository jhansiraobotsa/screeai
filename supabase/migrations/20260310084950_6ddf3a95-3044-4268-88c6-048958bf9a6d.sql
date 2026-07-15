
-- Fix overly permissive INSERT policies for transcript_events, ai_turns, scores
DROP POLICY "System can insert transcripts" ON public.transcript_events;
DROP POLICY "System can insert AI turns" ON public.ai_turns;
DROP POLICY "System can insert scores" ON public.scores;

CREATE POLICY "Authenticated users can insert transcripts for their interviews" ON public.transcript_events
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews
    WHERE org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Authenticated users can insert AI turns for their interviews" ON public.ai_turns
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews
    WHERE org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Authenticated users can insert scores for their interviews" ON public.scores
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (
    SELECT id FROM public.interviews
    WHERE org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  ));
