import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Users, Clock, TrendingUp, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import NewInterviewDialog from "@/components/interviews/NewInterviewDialog";

interface RecentInterview {
  id: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  candidates: { full_name: string } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [stats, setStats] = useState({ interviews: 0, candidates: 0, live: 0, completed: 0 });
  const [recent, setRecent] = useState<RecentInterview[]>([]);

  useEffect(() => {
    if (!profile?.org_id) return;

    const fetchStats = async () => {
      const [interviewsRes, candidatesRes, liveRes, completedRes, recentRes] = await Promise.all([
        supabase.from("interviews").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id!),
        supabase.from("candidates").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id!),
        supabase.from("interviews").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id!).eq("status", "live"),
        supabase.from("interviews").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id!).eq("status", "completed"),
        supabase.from("interviews").select("id, status, created_at, scheduled_at, candidates(full_name)").eq("org_id", profile.org_id!).order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        interviews: interviewsRes.count || 0,
        candidates: candidatesRes.count || 0,
        live: liveRes.count || 0,
        completed: completedRes.count || 0,
      });
      setRecent((recentRes.data as unknown as RecentInterview[]) || []);
    };

    fetchStats();
  }, [profile?.org_id]);

  const statCards = [
    { label: "Total Interviews", value: stats.interviews, icon: Video },
    { label: "Total Candidates", value: stats.candidates, icon: Users },
    { label: "Live Now", value: stats.live, icon: Clock },
    { label: "Completed", value: stats.completed, icon: TrendingUp },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case "live": return <Badge variant="live">● Live</Badge>;
      case "completed": return <Badge variant="default">Done</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
          </p>
        </div>
        <NewInterviewDialog onCreated={() => window.location.reload()} />
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                to="/interviews"
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Schedule Interview</p>
                    <p className="text-sm text-muted-foreground">Create a new AI interview session</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                to="/candidates"
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Add Candidate</p>
                    <p className="text-sm text-muted-foreground">Upload resume and send invite</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Interviews</CardTitle>
              <Badge variant="secondary">{stats.interviews} total</Badge>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No interviews yet</p>
                  <p className="text-sm text-muted-foreground/70">
                    Create your first AI-powered interview to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map(interview => (
                    <Link
                      key={interview.id}
                      to={`/interview-room/${interview.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{interview.candidates?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {interview.scheduled_at
                            ? format(new Date(interview.scheduled_at), "MMM d, h:mm a")
                            : format(new Date(interview.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      {statusBadge(interview.status)}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
