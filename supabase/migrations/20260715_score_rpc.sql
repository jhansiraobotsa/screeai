-- Allow the server (anon key) to persist AI scoring results without opening a
-- broad UPDATE policy on job_applications. This SECURITY DEFINER function only
-- writes the score/reasoning/resume_text columns for a given application.

CREATE OR REPLACE FUNCTION public.set_application_score(
  app_id UUID,
  p_score NUMERIC,
  p_reasoning TEXT,
  p_resume_text TEXT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.job_applications
  SET
    match_score = p_score,
    match_reasoning = p_reasoning,
    resume_text = COALESCE(p_resume_text, resume_text)
  WHERE id = app_id;
$$;

-- The server calls this with the anon (publishable) key.
GRANT EXECUTE ON FUNCTION public.set_application_score(UUID, NUMERIC, TEXT, TEXT) TO anon, authenticated;

-- Fetch the data the scorer needs, bypassing RLS (the anon-key server can't
-- SELECT job_applications directly). Returns the application + its job fields.
CREATE OR REPLACE FUNCTION public.get_application_for_scoring(app_id UUID)
RETURNS TABLE (
  id UUID,
  resume_url TEXT,
  resume_text TEXT,
  job_title TEXT,
  job_category TEXT,
  job_description_html TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.resume_url,
    a.resume_text,
    j.title,
    j.category,
    j.description_html
  FROM public.job_applications a
  JOIN public.jobs j ON j.id = a.job_id
  WHERE a.id = app_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_for_scoring(UUID) TO anon, authenticated;