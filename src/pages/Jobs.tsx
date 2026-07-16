import { useState, useEffect, useCallback, Fragment } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Plus, Search, Pencil, Eye, EyeOff, Users, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import JobEditorDialog from "@/components/jobs/JobEditorDialog";
import JobApplicantsInline from "@/components/jobs/JobApplicantsInline";
import type { Tables } from "@/integrations/supabase/types";

export default function Jobs() {
  const { profile } = useProfile();
  const [jobs, setJobs] = useState<Tables<"jobs">[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Tables<"jobs"> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Failed to load jobs");
    } else {
      setJobs(data || []);
      // Applicant count per job.
      const ids = (data || []).map(j => j.id);
      if (ids.length) {
        const { data: apps } = await supabase
          .from("job_applications")
          .select("job_id")
          .in("job_id", ids);
        const map: Record<string, number> = {};
        (apps || []).forEach(a => { map[a.job_id] = (map[a.job_id] || 0) + 1; });
        setCounts(map);
      }
    }
    setLoading(false);
  }, [profile?.org_id]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const categorySuggestions = Array.from(new Set(jobs.map(j => j.category).filter(Boolean)));

  const openCreate = () => {
    setEditingJob(null);
    setEditorOpen(true);
  };

  const openEdit = (job: Tables<"jobs">) => {
    setEditingJob(job);
    setEditorOpen(true);
  };

  const togglePublish = async (job: Tables<"jobs">) => {
    const next = job.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("jobs").update({ status: next }).eq("id", job.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(next === "published" ? "Job published" : "Job unpublished");
      // Notify org users when a job goes live.
      if (next === "published") {
        fetch("/api/notify/job-published", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        }).catch(() => {});
      }
      fetchJobs();
    }
  };

  const filtered = jobs.filter(
    j =>
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.category.toLowerCase().includes(search.toLowerCase())
  );

  const expiryLabel = (expiresAt: string | null) => {
    if (!expiresAt) return <span className="text-muted-foreground">No expiry</span>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiresAt);
    const days = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return <Badge variant="destructive">Expired</Badge>;
    if (days === 0) return <Badge variant="destructive">Expires today</Badge>;
    return (
      <span className={days <= 3 ? "text-destructive font-medium" : "text-muted-foreground"}>
        {days} day{days === 1 ? "" : "s"} left
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-1">Create and publish job openings</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Job
        </Button>
      </motion.div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search jobs..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <Briefcase className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No jobs yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Create your first job opening by clicking "Create Job" above.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(job => {
                const isOpen = expandedId === job.id;
                return (
                  <Fragment key={job.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isOpen ? null : job.id)}
                    >
                      <TableCell>
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{job.title}</p>
                        {job.location && (
                          <p className="text-xs text-muted-foreground">{job.location}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{job.category}</TableCell>
                      <TableCell>
                        {job.status === "published" ? (
                          <Badge variant="default">Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {counts[job.id] || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{expiryLabel(job.expires_at)}</TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => togglePublish(job)}>
                            {job.status === "published" ? (
                              <>
                                <EyeOff className="h-3 w-3 mr-1" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3 mr-1" />
                                Publish
                              </>
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(job)}>
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <JobApplicantsInline jobId={job.id} category={job.category} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <JobEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        job={editingJob}
        categorySuggestions={categorySuggestions}
        onSaved={fetchJobs}
      />
    </div>
  );
}