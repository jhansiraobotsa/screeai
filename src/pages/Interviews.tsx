import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Video, Search, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import NewInterviewDialog from "@/components/interviews/NewInterviewDialog";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface InterviewRow {
  id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  invite_token: string | null;
  candidates: { full_name: string; email: string } | null;
  question_packs: { title: string } | null;
}

export default function Interviews() {
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const { profile } = useProfile();

  const fetchInterviews = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    let query = supabase
      .from("interviews")
      .select("id, status, scheduled_at, started_at, ended_at, created_at, invite_token, candidates(full_name, email), question_packs(title)")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    setInterviews((data as unknown as InterviewRow[]) || []);
    setLoading(false);
  }, [profile?.org_id, statusFilter]);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "created": return <Badge variant="outline">Created</Badge>;
      case "room_ready": return <Badge variant="secondary">Ready</Badge>;
      case "waiting_for_candidate": return <Badge variant="secondary">Waiting</Badge>;
      case "live": return <Badge variant="live">● Live</Badge>;
      case "completed": return <Badge variant="default">Completed</Badge>;
      case "wrap_up": return <Badge variant="secondary">Wrapping Up</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/candidate/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard");
  };

  const filtered = interviews.filter(i =>
    !search ||
    i.candidates?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.candidates?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interviews</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor AI interview sessions</p>
        </div>
        <NewInterviewDialog onCreated={fetchInterviews} />
      </motion.div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search interviews..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          {["all", "created", "live", "completed"].map(s => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s === "all" ? "All" : s}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <Video className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No interviews found</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Create an interview by clicking "New Interview" above.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map(interview => (
                <Card key={interview.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {interview.candidates?.full_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {interview.candidates?.email}
                        </p>
                      </div>
                      {statusBadge(interview.status)}
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        <span className="text-foreground/70">Pack: </span>
                        {interview.question_packs?.title || "None"}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground/70">Scheduled: </span>
                        {interview.scheduled_at
                          ? format(new Date(interview.scheduled_at), "MMM d, yyyy h:mm a")
                          : "—"}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground/70">Created: </span>
                        {format(new Date(interview.created_at), "MMM d, yyyy")}
                      </p>
                    </div>

                    <div className="mt-auto flex gap-1 pt-2">
                      {interview.invite_token && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => copyInviteLink(interview.invite_token!)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Invite
                        </Button>
                      )}
                      <Button variant="gradient" size="sm" className="flex-1" asChild>
                        <Link to={`/interview-room/${interview.id}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
