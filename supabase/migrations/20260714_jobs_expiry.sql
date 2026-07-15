-- Add expiry to job postings and hide expired jobs from the public/user view.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS expires_at DATE;

-- Replace the public read policy so users only see published, non-expired jobs.
-- (Admins still see everything in their org via the admin policies, including
--  expired ones.)
DROP POLICY IF EXISTS "Anyone can view published jobs" ON public.jobs;
CREATE POLICY "Anyone can view published jobs" ON public.jobs
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  );