import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ResumeUploader from "@/components/mock-session/ResumeUploader";
import QuestionReview from "@/components/mock-session/QuestionReview";
import SchedulePicker from "@/components/mock-session/SchedulePicker";

interface Question {
  id: string;
  text: string;
  order: number;
  type: string;
}

type Step = "upload" | "generating" | "review" | "schedule";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "review", label: "Questions" },
  { id: "schedule", label: "Start" },
];

export default function NewMockSession() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [step, setStep] = useState<Step>("upload");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  const canGenerate = jobDescription.trim().length > 20;

  // Step 1 → Step 2: Generate questions
  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error("Please provide a more detailed job description");
      return;
    }

    setStep("generating");
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: resumeText.substring(0, 3000),
          jobDescription,
          jobTitle,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions generated");
      }

      setQuestions(data.questions);
      setStep("review");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate questions");
      setStep("upload");
    }
  };

  // Regenerate questions
  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: resumeText.substring(0, 3000),
          jobDescription,
          jobTitle,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestions(data.questions);
      toast.success("Questions regenerated");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setLoading(false);
    }
  };

  // Upload resume to storage if file exists
  const uploadResume = async (): Promise<string | null> => {
    if (!resumeFile || !user) return null;
    const path = `${user.id}/${Date.now()}_${resumeFile.name}`;
    const { error } = await supabase.storage
      .from("resumes")
      .upload(path, resumeFile);
    if (error) {
      console.error("Resume upload error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(path);
    return urlData.publicUrl;
  };

  // Create session and start immediately
  const handleStartNow = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const resumeUrl = await uploadResume();

      // Create mock session
      const res = await fetch("/api/mock-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          orgId: profile?.org_id,
          resumeUrl,
          resumeText,
          jobDescription,
          jobTitle,
          questions,
        }),
      });

      const session = await res.json();
      if (!res.ok) throw new Error(session.error);

      // Start the interview
      const startRes = await fetch(`/api/mock-session/${session.id}/start`, {
        method: "POST",
      });

      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error);

      navigate(`/interview-room/${startData.interviewId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to start interview");
    } finally {
      setLoading(false);
    }
  };

  // Create session and schedule for later
  const handleSchedule = async (scheduledAt: string) => {
    if (!user) return;
    setLoading(true);

    try {
      const resumeUrl = await uploadResume();

      const res = await fetch("/api/mock-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          orgId: profile?.org_id,
          resumeUrl,
          resumeText,
          jobDescription,
          jobTitle,
          questions,
          scheduledAt,
        }),
      });

      const session = await res.json();
      if (!res.ok) throw new Error(session.error);

      toast.success("Interview scheduled!");
      navigate("/spaces");
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule interview");
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === "generating" ? 0 : STEPS.findIndex(s => s.id === step);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/spaces")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">New Mock Interview</h1>
          <p className="text-sm text-muted-foreground">AI-powered interview practice</p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i <= stepIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i <= stepIndex ? "font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Upload */}
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    placeholder="e.g., Senior Frontend Engineer"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="jobDesc">Job Description *</Label>
                  <Textarea
                    id="jobDesc"
                    value={jobDescription}
                    onChange={e => setJobDescription(e.target.value)}
                    placeholder="Paste the job description or requirements here..."
                    className="min-h-[140px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {jobDescription.length < 20
                      ? `${20 - jobDescription.length} more characters needed`
                      : "Good to go"}
                  </p>
                </div>

                <ResumeUploader
                  resumeText={resumeText}
                  onResumeTextChange={setResumeText}
                  onFileUpload={setResumeFile}
                />

                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="w-full"
                  variant="gradient"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Interview Questions
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step 1.5: Generating */}
            {step === "generating" && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <h3 className="font-semibold text-lg">Generating your questions...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  AI is crafting 10 personalized interview questions based on your resume and the job description
                </p>
              </motion.div>
            )}

            {/* Step 2: Review questions */}
            {step === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <QuestionReview
                  questions={questions}
                  onRegenerate={handleRegenerate}
                  onConfirm={() => setStep("schedule")}
                  regenerating={loading}
                />
              </motion.div>
            )}

            {/* Step 3: Schedule or start */}
            {step === "schedule" && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <SchedulePicker
                  onStartNow={handleStartNow}
                  onSchedule={handleSchedule}
                  loading={loading}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
