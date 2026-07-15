-- Allow a logged-in user to SELECT interviews whose candidate email matches
-- their own account email. This is what makes the "Interviews You've Been
-- Invited To" section on /spaces show anything, since the invited user is in
-- a different org than the admin who created the interview.

-- 1. Interviews where the candidate email == the caller's auth email
DROP POLICY IF EXISTS "Users can view interviews matching their email" ON public.interviews;
CREATE POLICY "Users can view interviews matching their email" ON public.interviews
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (
      SELECT c.id FROM public.candidates c
      WHERE lower(c.email) = lower((auth.jwt() ->> 'email'))
    )
  );

-- 2. The interviews query joins candidates!inner(...), so the caller must also
--    be able to SELECT the matching candidate row. Add an email-match read
--    policy on candidates (existing org policy stays; policies are OR'd).
DROP POLICY IF EXISTS "Users can view own candidate record" ON public.candidates;
CREATE POLICY "Users can view own candidate record" ON public.candidates
  FOR SELECT TO authenticated
  USING (lower(email) = lower((auth.jwt() ->> 'email')));

-- 3. The query also joins question_packs(title). Allow reading question packs
--    referenced by an interview the caller can see via email match.
DROP POLICY IF EXISTS "Users can view question packs for their interviews" ON public.question_packs;
CREATE POLICY "Users can view question packs for their interviews" ON public.question_packs
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT i.question_pack_id FROM public.interviews i
      JOIN public.candidates c ON c.id = i.candidate_id
      WHERE lower(c.email) = lower((auth.jwt() ->> 'email'))
    )
  );
