-- Estimated AI/API cost per interview. One row per interview, upserted when the
-- interview completes. Values are USD estimates (see server/costRates.ts).

CREATE TABLE IF NOT EXISTS public.interview_costs (
  interview_id UUID NOT NULL PRIMARY KEY REFERENCES public.interviews(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  voice_cost NUMERIC NOT NULL DEFAULT 0,
  transcription_cost NUMERIC NOT NULL DEFAULT 0,
  claude_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  breakdown JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_costs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_interview_costs_org ON public.interview_costs(org_id);

-- Admins can read costs for interviews in their org.
DROP POLICY IF EXISTS "Admins can view org interview costs" ON public.interview_costs;
CREATE POLICY "Admins can view org interview costs" ON public.interview_costs
  FOR SELECT TO authenticated
  USING (org_id = public.get_my_org_id() AND public.has_role(auth.uid(), 'admin'));

-- Server (anon key) upserts costs via a SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.record_interview_cost(
  p_interview_id UUID,
  p_duration_seconds INTEGER,
  p_voice NUMERIC,
  p_transcription NUMERIC,
  p_claude NUMERIC,
  p_total NUMERIC,
  p_breakdown JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT org_id INTO v_org FROM public.interviews WHERE id = p_interview_id;
  INSERT INTO public.interview_costs (interview_id, org_id, duration_seconds, voice_cost, transcription_cost, claude_cost, total_cost, breakdown, updated_at)
  VALUES (p_interview_id, v_org, p_duration_seconds, p_voice, p_transcription, p_claude, p_total, p_breakdown, now())
  ON CONFLICT (interview_id) DO UPDATE SET
    duration_seconds = EXCLUDED.duration_seconds,
    voice_cost = EXCLUDED.voice_cost,
    transcription_cost = EXCLUDED.transcription_cost,
    claude_cost = EXCLUDED.claude_cost,
    total_cost = EXCLUDED.total_cost,
    breakdown = EXCLUDED.breakdown,
    updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_interview_cost(UUID, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) TO anon, authenticated;