import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, LayoutGrid, Loader2, Video, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SessionCard from "@/components/spaces/SessionCard";
import OpenPositions from "@/components/jobs/OpenPositions";

interface MockSession {
  id: string;
  user_id: string;
  job_title: string | null;
  job_description: string;
  status: string;
  scheduled_at: string | null;
  interview_id: string | null;
  invite_token: string | null;
  questions: unknown[];
  created_at: string;
}

interface InvitedInterview {
  id: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  invite_token: string | null;
  candidates: { full_name: string; email: string } | null;
  question_packs: { title: string } | null;
}

export default function Spaces() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState<MockSession[]>([]);
  const [invitedInterviews, setInvitedInterviews] = useState<InvitedInterview[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch sessions
  useEffect(() => {
    if (!user) return;

    const fetchSessions = async () => {
      const { data, error } = await supabase
        .from("mock_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching sessions:", error);
        toast.error("Failed to load sessions");
      } else {
        setSessions((data as unknown as MockSession[]) || []);
      }
    };

    // Interviews an admin has invited this user to — matched by the candidate's
    // email equalling the logged-in user's email.
    const fetchInvitedInterviews = async () => {
      if (!user.email) return;
      const { data, error } = await supabase
        .from("interviews")
        .select("id, status, scheduled_at, created_at, invite_token, candidates!inner(full_name, email), question_packs(title)")
        .eq("candidates.email", user.email)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching invited interviews:", error);
      } else {
        setInvitedInterviews((data as unknown as InvitedInterview[]) || []);
      }
    };

    Promise.all([fetchSessions(), fetchInvitedInterviews()]).finally(() => setLoading(false));

    // Handle invite token from email link
    const sessionToken = searchParams.get("session");
    if (sessionToken) {
      // Claim the session if it was created by an admin for this email
      claimSession(sessionToken);
    }
  }, [user, searchParams]);

  const claimSession = async (token: string) => {
    if (!user) return;
    // Update session's user_id if it's unclaimed (admin-scheduled)
    await supabase
      .from("mock_sessions")
      .update({ user_id: user.id })
      .eq("invite_token", token)
      .is("user_id", null);
  };

  const handleStart = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/mock-session/${sessionId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      navigate(`/interview-room/${data.interviewId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to start interview");
    }
  };

  const liveSessions = sessions.filter(s => s.status === "live");
  const upcomingSessions = sessions.filter(s =>
    ["questions_generated", "scheduled"].includes(s.status)
  );
  const completedSessions = sessions.filter(s => s.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeInvited = invitedInterviews.filter(iv => iv.status !== "completed");
  const completedInvited = invitedInterviews.filter(iv => iv.status === "completed");
  const activeSessions = [...liveSessions, ...upcomingSessions];
  const interviewsCount = activeSessions.length + activeInvited.length;
  const completedCount = completedSessions.length + completedInvited.length;

  const renderInvited = (list: InvitedInterview[]) => (
    <div className="grid gap-3">
      {list.map(iv => (
        <Card key={iv.id}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Video className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">{iv.question_packs?.title || "Interview"}</p>
                <p className="text-xs text-muted-foreground">
                  {iv.scheduled_at
                    ? format(new Date(iv.scheduled_at), "MMM d, yyyy 'at' h:mm a")
                    : "Flexible timing"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="capitalize">
                {iv.status === "completed" ? "Completed" : iv.status}
              </Badge>
              {iv.invite_token && iv.status !== "completed" && (
                <Button
                  size="sm"
                  variant="gradient"
                  onClick={() => navigate(`/candidate/${iv.invite_token}`)}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Spaces</h1>
          <p className="text-muted-foreground mt-1">Your positions, interviews and mock sessions</p>
        </div>
        <Button onClick={() => navigate("/new-session")} variant="gradient">
          <Plus className="h-4 w-4 mr-2" />
          New Mock Interview
        </Button>
      </div>

      <Tabs defaultValue="interviews">
        <TabsList>
          <TabsTrigger value="interviews">Interviews{interviewsCount ? ` (${interviewsCount})` : ""}</TabsTrigger>
          <TabsTrigger value="positions">Open Positions</TabsTrigger>
          <TabsTrigger value="completed">Completed{completedCount ? ` (${completedCount})` : ""}</TabsTrigger>
        </TabsList>

        {/* Interviews: active invited + in-progress + upcoming (no completed) */}
        <TabsContent value="interviews" className="mt-4 space-y-6">
          {interviewsCount === 0 ? (
            <EmptyState
              title="No interviews yet"
              body="Interviews you're invited to, or mock sessions in progress, will appear here."
              onNew={() => navigate("/new-session")}
            />
          ) : (
            <>
              {activeInvited.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Invited By Recruiter
                  </h2>
                  {renderInvited(activeInvited)}
                </section>
              )}
              {liveSessions.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    In Progress
                  </h2>
                  <div className="grid gap-3">
                    {liveSessions.map(s => <SessionCard key={s.id} session={s} onStart={handleStart} />)}
                  </div>
                </section>
              )}
              {upcomingSessions.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Upcoming Mock Sessions
                  </h2>
                  <div className="grid gap-3">
                    {upcomingSessions.map(s => <SessionCard key={s.id} session={s} onStart={handleStart} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </TabsContent>

        {/* Open positions */}
        <TabsContent value="positions" className="mt-4">
          <OpenPositions emptyFallback />
        </TabsContent>

        {/* Completed: completed invited interviews + completed mock sessions */}
        <TabsContent value="completed" className="mt-4 space-y-6">
          {completedCount === 0 ? (
            <EmptyState title="Nothing completed yet" body="Completed interviews and mock sessions will show up here." />
          ) : (
            <>
              {completedInvited.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Interviews
                  </h2>
                  {renderInvited(completedInvited)}
                </section>
              )}
              {completedSessions.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Mock Sessions
                  </h2>
                  <div className="grid gap-3">
                    {completedSessions.map(s => <SessionCard key={s.id} session={s} onStart={handleStart} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ title, body, onNew }: { title: string; body: string; onNew?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
        <LayoutGrid className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">{body}</p>
      {onNew && (
        <Button onClick={onNew} variant="gradient">
          <Plus className="h-4 w-4 mr-2" />
          Start a Mock Interview
        </Button>
      )}
    </motion.div>
  );
}
