import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Tables<"jobs"> | null;
  onApplied: () => void;
}

const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function ApplyDialog({ open, onOpenChange, job, onApplied }: Props) {
  const { user, session } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFullName(user?.user_metadata?.full_name || "");
      setEmail(user?.email || "");
      setPhone("");
      setResumeFile(null);
    }
  }, [open, user]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please upload a PDF or DOCX file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume must be under 10 MB");
      return;
    }
    setResumeFile(file);
  };

  const submit = async () => {
    if (!user || !job) return;
    if (!fullName.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!resumeFile) {
      toast.error("Please attach your resume");
      return;
    }

    setSubmitting(true);
    try {
      // Guard against duplicate application (also enforced by a UNIQUE constraint)
      const { data: existing } = await supabase
        .from("job_applications")
        .select("id")
        .eq("job_id", job.id)
        .eq("applicant_id", user.id)
        .maybeSingle();
      if (existing) {
        toast.error("You've already applied to this job");
        onOpenChange(false);
        return;
      }

      // Upload resume to the server (stored on disk for now; S3/blob later).
      const form = new FormData();
      form.append("file", resumeFile);
      const uploadRes = await fetch("/api/uploads/resume", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Resume upload failed");

      const { data: inserted, error: insErr } = await supabase
        .from("job_applications")
        .insert({
          job_id: job.id,
          applicant_id: user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          resume_url: uploadData.url,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Fire-and-forget AI relevance scoring (resume vs job). Don't block the
      // candidate on it — the admin view shows "Not scored" until it lands.
      if (inserted?.id) {
        fetch("/api/jobs/score-application", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: inserted.id }),
        }).catch(err => console.error("Scoring request failed:", err));
      }

      toast.success("Application submitted!");
      onOpenChange(false);
      onApplied();
    } catch (err: any) {
      // Unique-violation code from Postgres when they somehow double-submit
      if (err.code === "23505") {
        toast.error("You've already applied to this job");
      } else {
        toast.error(err.message || "Failed to submit application");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply — {job?.title}</DialogTitle>
          <DialogDescription>
            Submit your details and resume for this position.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apply-name">Full Name *</Label>
            <Input id="apply-name" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apply-email">Email *</Label>
            <Input id="apply-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apply-phone">Phone</Label>
            <Input id="apply-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-1.5">
            <Label>Resume (PDF or DOCX) *</Label>
            {resumeFile ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{resumeFile.name}</span>
                </div>
                <button type="button" onClick={() => setResumeFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input py-6 text-sm text-muted-foreground hover:bg-accent"
              >
                <Upload className="h-4 w-4" />
                Click to upload your resume
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => pickFile(e.target.files?.[0])}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}