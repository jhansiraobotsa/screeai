
-- Allow anonymous/public read access to interviews by invite_token for candidate portal
CREATE POLICY "Public can view interviews by invite token"
ON public.interviews FOR SELECT
TO anon
USING (invite_token IS NOT NULL);

-- Allow anonymous access to candidates referenced by public interviews
CREATE POLICY "Public can view candidate by interview"
ON public.candidates FOR SELECT
TO anon
USING (id IN (SELECT candidate_id FROM public.interviews WHERE invite_token IS NOT NULL));

-- Allow anonymous access to question pack titles for interview info
CREATE POLICY "Public can view question pack title by interview"
ON public.question_packs FOR SELECT
TO anon
USING (id IN (SELECT question_pack_id FROM public.interviews WHERE invite_token IS NOT NULL AND question_pack_id IS NOT NULL));
