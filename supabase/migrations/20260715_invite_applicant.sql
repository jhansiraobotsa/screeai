-- Store resume-based generated questions directly on the interview (for the
-- invited-applicant flow, which has no question_pack or mock_session).
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS questions JSONB;

-- Turn a job application into an interview: find-or-create a candidate in the
-- job's org (copying resume), then create an interview. SECURITY DEFINER so the
-- anon-key server can do this past RLS. Returns the new interview id + token.

CREATE OR REPLACE FUNCTION public.create_interview_from_application(app_id UUID)
RETURNS TABLE (interview_id UUID, invite_token TEXT, candidate_email TEXT, candidate_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_org UUID;
  v_candidate_id UUID;
  v_interview_id UUID;
  v_token TEXT;
BEGIN
  -- Load the application + job org.
  SELECT a.*, j.org_id AS job_org
  INTO v_app
  FROM public.job_applications a
  JOIN public.jobs j ON j.id = a.job_id
  WHERE a.id = app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  v_org := v_app.job_org;

  -- Find an existing candidate by email in this org, else create one.
  SELECT id INTO v_candidate_id
  FROM public.candidates
  WHERE org_id = v_org AND lower(email) = lower(v_app.email)
  LIMIT 1;

  IF v_candidate_id IS NULL THEN
    INSERT INTO public.candidates (org_id, full_name, email, phone, resume_url, resume_text, status)
    VALUES (v_org, v_app.full_name, lower(v_app.email), v_app.phone, v_app.resume_url, v_app.resume_text, 'active')
    RETURNING id INTO v_candidate_id;
  ELSE
    -- Refresh resume info from the application if the candidate lacks it.
    UPDATE public.candidates
    SET resume_url = COALESCE(resume_url, v_app.resume_url),
        resume_text = COALESCE(resume_text, v_app.resume_text)
    WHERE id = v_candidate_id;
  END IF;

  -- Reuse an existing non-completed interview for this candidate+org if present,
  -- otherwise create a new one.
  SELECT id, i.invite_token INTO v_interview_id, v_token
  FROM public.interviews i
  WHERE i.org_id = v_org AND i.candidate_id = v_candidate_id AND i.status <> 'completed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_interview_id IS NULL THEN
    INSERT INTO public.interviews (org_id, candidate_id, status)
    VALUES (v_org, v_candidate_id, 'created')
    RETURNING id, interviews.invite_token INTO v_interview_id, v_token;
  END IF;

  RETURN QUERY SELECT v_interview_id, v_token, v_app.email, v_app.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_interview_from_application(UUID) TO anon, authenticated;

-- Fetch the data the question generator needs for an interview, past RLS.
CREATE OR REPLACE FUNCTION public.get_interview_for_qgen(iv_id UUID)
RETURNS TABLE (
  interview_id UUID,
  candidate_name TEXT,
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
    i.id,
    c.full_name,
    c.resume_text,
    -- Best-effort: link job by the candidate's most recent application.
    (SELECT j.title FROM public.job_applications a JOIN public.jobs j ON j.id = a.job_id
       WHERE lower(a.email) = lower(c.email) ORDER BY a.created_at DESC LIMIT 1),
    (SELECT j.category FROM public.job_applications a JOIN public.jobs j ON j.id = a.job_id
       WHERE lower(a.email) = lower(c.email) ORDER BY a.created_at DESC LIMIT 1),
    (SELECT j.description_html FROM public.job_applications a JOIN public.jobs j ON j.id = a.job_id
       WHERE lower(a.email) = lower(c.email) ORDER BY a.created_at DESC LIMIT 1)
  FROM public.interviews i
  JOIN public.candidates c ON c.id = i.candidate_id
  WHERE i.id = iv_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_interview_for_qgen(UUID) TO anon, authenticated;

-- Save generated questions onto an interview, past RLS.
CREATE OR REPLACE FUNCTION public.set_interview_questions(iv_id UUID, p_questions JSONB)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.interviews SET questions = p_questions WHERE id = iv_id;
$$;
GRANT EXECUTE ON FUNCTION public.set_interview_questions(UUID, JSONB) TO anon, authenticated;