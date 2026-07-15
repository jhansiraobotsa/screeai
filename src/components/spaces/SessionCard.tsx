import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, CheckCircle2, Calendar, ArrowRight, BarChart3 } from "lucide-react";

interface MockSession {
  id: string;
  job_title: string | null;
  job_description: string;
  status: string;
  scheduled_at: string | null;
  interview_id: string | null;
  questions: unknown[];
  created_at: string;
}

interface SessionCardProps {
  session: MockSession;
  onStart: (sessionId: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: <Clock className="h-3 w-3" /> },
  questions_generated: { label: "Ready", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  scheduled: { label: "Scheduled", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: <Calendar className="h-3 w-3" /> },
  live: { label: "In Progress", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <Play className="h-3 w-3" /> },
  completed: { label: "Completed", color: "bg-slate-500/10 text-slate-600 border-slate-500/20", icon: <BarChart3 className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: null },
};

function formatScheduled(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs < 0) return "Past due";
  if (diffH < 1) return `In ${diffM}m`;
  if (diffH < 24) return `In ${diffH}h ${diffM}m`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function SessionCard({ session, onStart }: SessionCardProps) {
  const navigate = useNavigate();
  const config = statusConfig[session.status] || statusConfig.pending;

  const handleAction = () => {
    if (session.status === "live" && session.interview_id) {
      navigate(`/interview-room/${session.interview_id}`);
    } else if (session.status === "completed" && session.interview_id) {
      navigate(`/interview-room/${session.interview_id}`);
    } else {
      onStart(session.id);
    }
  };

  const actionLabel = session.status === "live"
    ? "Rejoin"
    : session.status === "completed"
      ? "View Results"
      : "Start Now";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="font-semibold text-base truncate">
                  {session.job_title || "Mock Interview"}
                </h3>
                <Badge variant="outline" className={`text-[11px] shrink-0 ${config.color}`}>
                  <span className="mr-1">{config.icon}</span>
                  {config.label}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {session.job_description.substring(0, 120)}
                {session.job_description.length > 120 ? "..." : ""}
              </p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{(session.questions as unknown[])?.length || 0} questions</span>
                {session.scheduled_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatScheduled(session.scheduled_at)}
                  </span>
                )}
                <span>
                  {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>

            {session.status !== "cancelled" && session.status !== "pending" && (
              <Button
                size="sm"
                variant={session.status === "live" ? "default" : "outline"}
                className="shrink-0"
                onClick={handleAction}
              >
                {actionLabel}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
