-- Phase 4: candidate tags. Tag a person (by email) with role(s) they fit, so
-- they auto-surface for future jobs whose category matches a tag.

CREATE TABLE IF NOT EXISTS public.candidate_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) NOT NULL,
  email TEXT NOT NULL,               -- the person, stored lowercased
  full_name TEXT,                    -- for display
  tag TEXT NOT NULL,                 -- role, e.g. "PHP Developer" (matched to job.category)
  experience_level TEXT,             -- optional, e.g. "Junior" / "Senior"
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email, tag)        -- no duplicate tag per person per org
);

ALTER TABLE public.candidate_tags ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_candidate_tags_org_id ON public.candidate_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_candidate_tags_email ON public.candidate_tags(email);
CREATE INDEX IF NOT EXISTS idx_candidate_tags_tag ON public.candidate_tags(lower(tag));

-- Admins manage tags within their org
DROP POLICY IF EXISTS "Admins can view org tags" ON public.candidate_tags;
CREATE POLICY "Admins can view org tags" ON public.candidate_tags
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert org tags" ON public.candidate_tags;
CREATE POLICY "Admins can insert org tags" ON public.candidate_tags
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete org tags" ON public.candidate_tags;
CREATE POLICY "Admins can delete org tags" ON public.candidate_tags
  FOR DELETE TO authenticated
  USING (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'));