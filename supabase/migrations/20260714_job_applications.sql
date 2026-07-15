-- Phase 2: job applications. A logged-in user applies to a published job with
-- their resume + basic details.

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT NOT NULL,
  resume_text TEXT,               -- populated later for AI scoring
  match_score NUMERIC,            -- populated later by the scoring step
  match_reasoning TEXT,           -- populated later by the scoring step
  status TEXT NOT NULL DEFAULT 'applied', -- applied | reviewing | rejected | shortlisted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)   -- one application per user per job
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id ON public.job_applications(applicant_id);

-- Applicant can see and manage their OWN applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.job_applications;
CREATE POLICY "Users can view own applications" ON public.job_applications
  FOR SELECT TO authenticated
  USING (applicant_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own applications" ON public.job_applications;
CREATE POLICY "Users can create own applications" ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());

-- The org's admins (owners of the job) can see all applications to their jobs
DROP POLICY IF EXISTS "Admins can view applications to org jobs" ON public.job_applications;
CREATE POLICY "Admins can view applications to org jobs" ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    job_id IN (SELECT id FROM public.jobs WHERE org_id = public.get_my_org_id())
    AND public.has_role(auth.uid(), 'admin')
  );

-- Admins can update application status on their org's jobs
DROP POLICY IF EXISTS "Admins can update applications to org jobs" ON public.job_applications;
CREATE POLICY "Admins can update applications to org jobs" ON public.job_applications
  FOR UPDATE TO authenticated
  USING (
    job_id IN (SELECT id FROM public.jobs WHERE org_id = public.get_my_org_id())
    AND public.has_role(auth.uid(), 'admin')
  );