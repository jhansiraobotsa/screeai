-- Phase 1: job postings.
-- Admins create/manage jobs within their org; published jobs are publicly readable.

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,               -- role/category used for tag auto-matching (e.g. "Python Developer")
  description_html TEXT NOT NULL DEFAULT '',
  location TEXT,
  employment_type TEXT,                 -- e.g. full-time, part-time, contract
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON public.jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- Admins manage jobs in their own org
DROP POLICY IF EXISTS "Admins can view org jobs" ON public.jobs;
CREATE POLICY "Admins can view org jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id());

DROP POLICY IF EXISTS "Admins can insert org jobs" ON public.jobs;
CREATE POLICY "Admins can insert org jobs" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update org jobs" ON public.jobs;
CREATE POLICY "Admins can update org jobs" ON public.jobs
  FOR UPDATE TO authenticated
  USING (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete org jobs" ON public.jobs;
CREATE POLICY "Admins can delete org jobs" ON public.jobs
  FOR DELETE TO authenticated
  USING (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'));

-- Published jobs are readable by anyone (public job board + logged-in applicants)
DROP POLICY IF EXISTS "Anyone can view published jobs" ON public.jobs;
CREATE POLICY "Anyone can view published jobs" ON public.jobs
  FOR SELECT TO anon, authenticated
  USING (status = 'published');