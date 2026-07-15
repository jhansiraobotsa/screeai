import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, CheckCircle, Clock, AlertCircle, Brain, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface InterviewInfo {
  id: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  candidates: { full_name: string; email: string } | null;
  question_packs: { title: string } | null;
}

export default function CandidatePortal() {
  const { invite } = useParams<{ invite: string }>();
  const [interview, setInterview] = useState<InterviewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [consented, setConsented] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!invite) return;

    const fetchInterview = async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select("id, status, scheduled_at, created_at, candidates(full_name, email), question_packs(title)")
        .eq("invite_token", invite)
        .maybeSingle();

      if (!data || error) {
        setNotFound(true);
      } else {
        setInterview(data as unknown as InterviewInfo);
      }
      setLoading(false);
    };

    fetchInterview();
  }, [invite]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Invite Link</h2>
            <p className="text-muted-foreground">
              This interview invite is invalid or has expired. Please contact your recruiter for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">InterviewAI</span>
          </div>
          <Badge variant="outline">Candidate Portal</Badge>
        </div>
      </header>

      <div className="container py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Welcome, {interview?.candidates?.full_name || "Candidate"}
          </h1>
          <p className="text-muted-foreground mb-8">
            You have an interview session scheduled. Review the details below and join when ready.
          </p>
        </motion.div>

        <div className="space-y-4">
          {/* Consent notice */}
          {!consented && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Interview Disclosure</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This interview will be conducted by an AI assistant named Alex. Your responses will be
                      transcribed and evaluated using AI. Audio will be processed in real-time for transcription purposes.
                      By proceeding, you consent to:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                      <li>AI-conducted interview with voice interaction</li>
                      <li>Real-time speech transcription</li>
                      <li>AI evaluation of your responses</li>
                    </ul>
                    <Button
                      variant="gradient"
                      className="mt-4"
                      onClick={() => setConsented(true)}
                    >
                      I Understand & Consent
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interview Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Interview Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      interview?.status === "live"
                        ? "live"
                        : interview?.status === "completed"
                        ? "default"
                        : "outline"
                    }
                    className="mt-1 capitalize"
                  >
                    {interview?.status === "live" ? "● Live" : interview?.status || "Pending"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-sm font-medium mt-1">
                    {interview?.scheduled_at
                      ? format(new Date(interview.scheduled_at), "MMMM d, yyyy 'at' h:mm a")
                      : "Flexible timing"}
                  </p>
                </div>
                {interview?.question_packs?.title && (
                  <div>
                    <p className="text-sm text-muted-foreground">Interview Type</p>
                    <p className="text-sm font-medium mt-1">{interview.question_packs.title}</p>
                  </div>
                )}
              </div>

              {consented && interview?.status !== "completed" && (
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full mt-4"
                  onClick={() => window.open(`/interview-room/${interview?.id}`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Interview Room
                </Button>
              )}

              {interview?.status === "completed" && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-muted">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium">Interview Completed</p>
                    <p className="text-sm text-muted-foreground">
                      Thank you for completing the interview. The team will review and get back to you.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
