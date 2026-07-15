import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, MapPin, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ApplyDialog from "@/components/jobs/ApplyDialog";
import type { Tables } from "@/integrations/supabase/types";

function expiryText(expiresAt: string | null): { label: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((new Date(expiresAt).getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return null; // expired jobs are filtered out server-side anyway
  if (days === 0) return { label: "Closes today", urgent: true };
  return { label: `${days} day${days === 1 ? "" : "s"} left to apply`, urgent: days <= 3 };
}

export default function OpenPositions({ emptyFallback = false }: { emptyFallback?: boolean }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Tables<"jobs">[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applyJob, setApplyJob] = useState<Tables<"jobs"> | null>(null);

  const fetchApplied = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("job_applications")
      .select("job_id")
      .eq("applicant_id", user.id);
    setAppliedJobIds(new Set((data || []).map(a => a.job_id)));
  }, [user]);

  useEffect(() => {
    const fetchJobs = async () => {
      // RLS already limits this to published, non-expired jobs.
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error loading open positions:", error);
        toast.error("Failed to load open positions");
      } else {
        setJobs(data || []);
      }
      setLoading(false);
    };
    fetchJobs();
    fetchApplied();
  }, [fetchApplied]);

  if (loading) return null;

  if (jobs.length === 0) {
    if (!emptyFallback) return null;
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
          <Briefcase className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">No open positions</h2>
        <p className="text-muted-foreground max-w-sm">
          There are no job openings right now. Check back later.
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Open Positions
      </h2>
      <div className="grid gap-3">
        {jobs.map(job => {
          const exp = expiryText(job.expires_at);
          return (
            <Card key={job.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{job.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[11px]">{job.category}</Badge>
                      {job.employment_type && (
                        <span className="text-xs text-muted-foreground">{job.employment_type}</span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </span>
                      )}
                    </div>
                    {exp && (
                      <p className={`text-xs mt-1 ${exp.urgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {exp.label}
                      </p>
                    )}
                  </div>
                </div>
                {appliedJobIds.has(job.id) ? (
                  <Button size="sm" variant="outline" disabled className="shrink-0">
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Applied
                  </Button>
                ) : (
                  <Button size="sm" variant="gradient" className="shrink-0" onClick={() => setApplyJob(job)}>
                    Apply
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ApplyDialog
        open={!!applyJob}
        onOpenChange={o => !o && setApplyJob(null)}
        job={applyJob}
        onApplied={fetchApplied}
      />
    </section>
  );
}