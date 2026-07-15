
-- Create resume storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users in the same org can upload/view resumes
CREATE POLICY "Org members can upload resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Org members can view resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes');

CREATE POLICY "Org members can delete resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resumes');

-- Enable realtime for transcript_events and ai_turns
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcript_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;
