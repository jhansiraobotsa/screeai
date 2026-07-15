import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, LineChart, Line,
} from "recharts";
import {
  TrendingUp, Users, Video, CheckCircle2,
  Star, Clock, Award, BarChart3,
} from "lucide-react";

interface ScoreRow {
  dimension: string;
  score: number;
  created_at: string;
  interview_id: string;
}

interface InterviewRow {
  id: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  candidates: { full_name: string } | null;
}

const DIMENSION_ORDER = [
  "Communication",
  "Technical Knowledge",
  "Problem Solving",
  "Cultural Fit",
  "Overall",
];

const dimColor = (avg: number) =>
  avg >= 8 ? "#10b981" : avg >= 5 ? "#f59e0b" : "#ef4444";

export default function Analytics() {
  const { profile } = useProfile();
  const [scores,     setScores]     = useState<ScoreRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!profile?.org_id) return;
    (async () => {
      const [{ data: sc }, { data: iv }] = await Promise.all([
        supabase
          .from("scores")
          .select("dimension, score, created_at, interview_id")
          .in(
            "interview_id",
            (await supabase.from("interviews").select("id").eq("org_id", profile.org_id!)).data?.map(r => r.id) ?? []
          )
          .order("created_at", { ascending: true }),
        supabase
          .from("interviews")
          .select("id, status, started_at, ended_at, candidates(full_name)")
          .eq("org_id", profile.org_id!)
          .order("created_at", { ascending: false }),
      ]);
      setScores((sc as ScoreRow[]) ?? []);
      setInterviews((iv as unknown as InterviewRow[]) ?? []);
      setLoading(false);
    })();
  }, [profile?.org_id]);

  // ─── Derived stats ────────────────────────────────────────────────────────

  const completed = interviews.filter(i => i.status === "completed");
  const live      = interviews.filter(i => i.status === "live");

  // Average score per dimension
  const dimAvg = DIMENSION_ORDER.map(dim => {
    const rows = scores.filter(s => s.dimension === dim);
    const avg  = rows.length ? rows.reduce((a, b) => a + b.score, 0) / rows.length : 0;
    return { dimension: dim.replace(" ", "\n"), avg: parseFloat(avg.toFixed(1)) };
  });

  // Overall average across all dimensions
  const overallAvg = scores.length
    ? parseFloat((scores.reduce((a, b) => a + b.score, 0) / scores.length).toFixed(1))
    : 0;

  // Average interview duration
  const durations = completed
    .filter(i => i.started_at && i.ended_at)
    .map(i => (new Date(i.ended_at!).getTime() - new Date(i.started_at!).getTime()) / 60000);
  const avgDurationMins = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Scores over time (Overall per interview)
  const scoreTimeline = completed
    .slice(0, 10)
    .reverse()
    .map((iv, idx) => {
      const overall = scores.find(s => s.interview_id === iv.id && s.dimension === "Overall");
      return {
        label: `#${idx + 1}`,
        name: iv.candidates?.full_name ?? "Candidate",
        score: overall?.score ?? 0,
      };
    })
    .filter(d => d.score > 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Interview performance and candidate evaluation insights</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Interviews",  value: interviews.length, icon: Video,       color: "text-blue-500",    bg: "bg-blue-500/10" },
          { label: "Completed",          value: completed.length,  icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Overall Avg Score",  value: overallAvg ? `${overallAvg}/10` : "—", icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Avg Duration",       value: avgDurationMins ? `${avgDurationMins} min` : "—", icon: Clock, color: "text-violet-500", bg: "bg-violet-500/10" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Average score per dimension — bar chart */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Average Score by Dimension</h3>
          </div>
          {dimAvg.some(d => d.avg > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dimAvg} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dimension" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}/10`, "Avg Score"]}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}
                  fill="hsl(var(--primary))"
                  label={{ position: "top", fontSize: 11, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => v > 0 ? v : "" }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No evaluation data yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Complete an interview to see scores here</p>
            </div>
          )}
        </Card>

        {/* Radar chart */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Award className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Competency Radar</h3>
          </div>
          {dimAvg.some(d => d.avg > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={dimAvg}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
                <Radar name="Score" dataKey="avg" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}/10`]} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <Award className="h-10 w-10 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No evaluation data yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Score timeline */}
      {scoreTimeline.length > 1 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Overall Score Trend</h3>
            <span className="text-xs text-muted-foreground ml-auto">Last {scoreTimeline.length} interviews</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, _: string, props: { payload?: { name: string } }) => [`${v}/10 — ${props.payload?.name ?? ""}`, "Score"]}
              />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-dimension leaderboard */}
      {dimAvg.some(d => d.avg > 0) && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Dimension Breakdown</h3>
          </div>
          <div className="space-y-3">
            {DIMENSION_ORDER.map(dim => {
              const rows = scores.filter(s => s.dimension === dim);
              const avg  = rows.length ? rows.reduce((a, b) => a + b.score, 0) / rows.length : 0;
              if (!avg) return null;
              return (
                <div key={dim} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-36 shrink-0">{dim}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: dimColor(avg) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(avg / 10) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-12 text-right" style={{ color: dimColor(avg) }}>
                    {avg.toFixed(1)}/10
                  </span>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {rows.length} {rows.length === 1 ? "interview" : "interviews"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent completed interviews table */}
      {completed.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Video className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Completed Interviews</h3>
            <Badge variant="secondary" className="ml-auto text-xs">{completed.length} total</Badge>
          </div>
          <div className="space-y-2">
            {completed.slice(0, 8).map(iv => {
              const ivScores = scores.filter(s => s.interview_id === iv.id);
              const overall  = ivScores.find(s => s.dimension === "Overall");
              const dur      = iv.started_at && iv.ended_at
                ? Math.round((new Date(iv.ended_at).getTime() - new Date(iv.started_at).getTime()) / 60000)
                : null;
              return (
                <div key={iv.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {iv.candidates?.full_name?.charAt(0) ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{iv.candidates?.full_name ?? "Unknown"}</p>
                      {iv.started_at && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(iv.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {dur ? ` · ${dur} min` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {overall ? (
                      <span className="text-sm font-bold" style={{ color: dimColor(overall.score) }}>
                        {overall.score}/10
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No score</span>
                    )}
                    <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">Done</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
