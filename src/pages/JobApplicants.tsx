import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ApplicantsList, { ApplicantRow } from "@/components/jobs/ApplicantsList";
import SuggestedFromTags from "@/components/jobs/SuggestedFromTags";
import type { Tables } from "@/integrations/supabase/types";

export default function JobApplicants() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Tables<"jobs"> | null>(null);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    const [jobRes, appsRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
      supabase
        .from("job_applications")
        .select("id, job_id, full_name, email, phone, resume_url, match_score, match_reasoning, status, created_at")
        .eq("job_id", jobId)
        .order("match_score", { ascending: false, nullsFirst: false }),
    ]);
    if (jobRes.error || appsRes.error) {
      toast.error("Failed to load applicants");
    } else {
      setJob(jobRes.data);
      setApplicants((appsRes.data as ApplicantRow[]) || []);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/jobs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Jobs
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          Applicants{job ? ` — ${job.title}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          {applicants.length} application{applicants.length === 1 ? "" : "s"}, ranked by relevance to the role
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <ApplicantsList applicants={applicants} onStatusChanged={fetchData} />
          {job && <SuggestedFromTags jobId={job.id} category={job.category} />}
        </div>
      )}
    </div>
  );
}