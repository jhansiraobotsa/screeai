import { useState, useEffect, useCallback, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import ApplicantsList, { ApplicantRow } from "@/components/jobs/ApplicantsList";

export default function Applicants() {
  const { profile } = useProfile();
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState("all");

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    // Only applications to jobs in this admin's org. RLS also enforces this.
    const { data: orgJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("org_id", profile.org_id);
    const jobIds = (orgJobs || []).map(j => j.id);

    if (jobIds.length === 0) {
      setApplicants([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("job_applications")
      .select("id, job_id, full_name, email, phone, resume_url, match_score, match_reasoning, status, created_at, jobs(title, category)")
      .in("job_id", jobIds)
      .order("match_score", { ascending: false, nullsFirst: false });

    if (error) toast.error("Failed to load applicants");
    else setApplicants((data as unknown as ApplicantRow[]) || []);
    setLoading(false);
  }, [profile?.org_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    applicants.forEach(a => { if (a.jobs) map.set(a.job_id, a.jobs.title); });
    return Array.from(map.entries());
  }, [applicants]);

  const shown = jobFilter === "all" ? applicants : applicants.filter(a => a.job_id === jobFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applicants</h1>
          <p className="text-muted-foreground mt-1">All applications across your jobs, ranked by relevance</p>
        </div>
        <div className="w-56">
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by job" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobOptions.map(([id, title]) => (
                <SelectItem key={id} value={id}>{title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ApplicantsList applicants={shown} showJobColumn onStatusChanged={fetchData} />
      )}
    </div>
  );
}