import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Search, FileText, Info, Loader2, Tag, Sparkles, Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import Pagination, { paginate } from "@/components/common/Pagination";
import TagCandidateDialog from "@/components/jobs/TagCandidateDialog";

export interface ApplicantRow {
  id: string;
  job_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  resume_url: string;
  match_score: number | null;
  match_reasoning: string | null;
  status: string;
  created_at: string;
  jobs?: { title: string; category: string } | null;
}

const PAGE_SIZE = 10;
const STATUSES = ["applied", "reviewing", "shortlisted", "rejected"];

function scoreColor(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 75) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (score >= 50) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-red-500/15 text-red-600 border-red-500/30";
}

interface Props {
  applicants: ApplicantRow[];
  showJobColumn?: boolean;      // global view shows which job each app is for
  onStatusChanged?: () => void;
}

export default function ApplicantsList({ applicants, showJobColumn, onStatusChanged }: Props) {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tagTarget, setTagTarget] = useState<{ email: string; fullName: string } | null>(null);
  const [scoring, setScoring] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sendInvites = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setInviting(true);
    try {
      const res = await fetch("/api/jobs/invite-applicants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Interview invite sent to ${data.sent} of ${data.total}`);
      if (data.sent < data.total) {
        toast.error(`${data.total - data.sent} failed — check server logs`);
      }
      setSelected(new Set());
      onStatusChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invites");
    } finally {
      setInviting(false);
    }
  };

  const filtered = useMemo(() => {
    return applicants
      .filter(a =>
        !search ||
        a.full_name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
      )
      .filter(a => statusFilter === "all" || a.status === statusFilter)
      .filter(a => minScore === 0 || (a.match_score !== null && a.match_score >= minScore))
      .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
  }, [applicants, search, statusFilter, minScore]);

  // Reset to page 1 whenever filters change the result set size.
  const pageItems = paginate(filtered, page, PAGE_SIZE);

  const changeStatus = async (id: string, status: string) => {
    setUpdating(id);
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
    setUpdating(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      onStatusChanged?.();
    }
  };

  const scoreApplication = async (id: string) => {
    setScoring(id);
    try {
      const res = await fetch("/api/jobs/score-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.scored) {
        toast.success(`Scored: ${data.score}%`);
        onStatusChanged?.();
      } else {
        toast.error(data.reason || "Could not score (resume text unreadable)");
      }
    } catch (err: any) {
      toast.error(err.message || "Scoring failed");
    } finally {
      setScoring(null);
    }
  };

  const openResume = (url: string) => {
    // Download route requires auth; pass the token as a query param.
    const token = session?.access_token;
    window.open(`${url}?token=${encodeURIComponent(token || "")}`, "_blank");
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              className="pl-9"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="w-40">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <p className="text-xs text-muted-foreground mb-1">Min. score: {minScore}%</p>
            <Slider
              value={[minScore]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => { setMinScore(v); setPage(1); }}
            />
          </div>
        </div>

        {/* Bulk invite bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
            <p className="text-sm">{selected.size} selected</p>
            <Button size="sm" variant="gradient" onClick={sendInvites} disabled={inviting}>
              {inviting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-3.5 w-3.5 mr-1.5" /> Send Interview Invite ({selected.size})</>
              )}
            </Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No applicants match your filters.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pageItems.map(a => (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      aria-label="Select applicant"
                    />
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${scoreColor(a.match_score)}`}>
                      {a.match_score !== null ? `${a.match_score}%` : "—"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{a.full_name}</p>
                        {a.match_reasoning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{a.match_reasoning}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.email}{a.phone ? ` · ${a.phone}` : ""}
                      </p>
                      {showJobColumn && a.jobs && (
                        <Badge variant="secondary" className="mt-1 text-[11px]">{a.jobs.title}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={a.status}
                      onValueChange={v => changeStatus(a.id, v)}
                      disabled={updating === a.id}
                    >
                      <SelectTrigger className="h-8 w-32">
                        {updating === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => openResume(a.resume_url)}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Resume
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTagTarget({ email: a.email, fullName: a.full_name })}
                    >
                      <Tag className="h-3.5 w-3.5 mr-1.5" />
                      Tag
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={scoring === a.id}
                      onClick={() => scoreApplication(a.id)}
                      title={a.match_score === null ? "Compute AI relevance score" : "Re-score"}
                    >
                      {scoring === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1.5">{a.match_score === null ? "Score" : "Re-score"}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      {tagTarget && (
        <TagCandidateDialog
          open={!!tagTarget}
          onOpenChange={o => !o && setTagTarget(null)}
          email={tagTarget.email}
          fullName={tagTarget.fullName}
        />
      )}
    </TooltipProvider>
  );
}