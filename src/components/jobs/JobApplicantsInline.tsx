import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ApplicantsList, { ApplicantRow } from "@/components/jobs/ApplicantsList";
import SuggestedFromTags from "@/components/jobs/SuggestedFromTags";

// Lazy-loaded applicants for a single job, rendered inline under its row.
export default function JobApplicantsInline({ jobId, category }: { jobId: string; category: string }) {
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApps = useCallback(async () => {
    const { data, error } = await supabase
      .from("job_applications")
      .select("id, job_id, full_name, email, phone, resume_url, match_score, match_reasoning, status, created_at")
      .eq("job_id", jobId)
      .order("match_score", { ascending: false, nullsFirst: false });
    if (error) toast.error("Failed to load applicants");
    else setApplicants((data as ApplicantRow[]) || []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {applicants.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">No applicants yet.</p>
      ) : (
        <ApplicantsList applicants={applicants} onStatusChanged={fetchApps} />
      )}
      <SuggestedFromTags jobId={jobId} category={category} />
    </div>
  );
}