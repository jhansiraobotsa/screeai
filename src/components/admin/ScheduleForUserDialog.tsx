import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ScheduleForUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillEmail?: string;
  prefillUserId?: string;
}

export default function ScheduleForUserDialog({
  open,
  onOpenChange,
  prefillEmail,
  prefillUserId,
}: ScheduleForUserDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState(prefillEmail || "");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email || !jobDescription) return;

    setLoading(true);
    try {
      const scheduledAt = date && time
        ? new Date(`${date}T${time}`).toISOString()
        : null;

      // First generate questions
      const qRes = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, jobTitle }),
      });

      const qData = await qRes.json();
      if (!qRes.ok) throw new Error(qData.error);

      // Find user by email to get their user_id
      // For now, create session with admin's user_id — will be claimed when user signs up
      const targetUserId = prefillUserId || user.id;

      // Create mock session
      const sessionRes = await fetch("/api/mock-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          jobDescription,
          jobTitle,
          questions: qData.questions,
          scheduledAt,
          createdBy: user.id,
        }),
      });

      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session.error);

      // Send email invitation
      const emailRes = await fetch("/api/email/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mockSessionId: session.id,
          recipientEmail: email,
          sentBy: user.id,
          interviewDetails: { jobTitle },
        }),
      });

      const emailData = await emailRes.json();
      if (!emailRes.ok) throw new Error(emailData.error);

      toast.success(`Invitation sent to ${email}`);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule interview");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail(prefillEmail || "");
    setJobTitle("");
    setJobDescription("");
    setDate("");
    setTime("");
  };

  const minDate = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Interview for User</DialogTitle>
          <DialogDescription>
            Create a mock interview session and send an email invitation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-email">User Email *</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-job-title">Job Title</Label>
            <Input
              id="admin-job-title"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g., Senior Backend Developer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-job-desc">Job Description *</Label>
            <Textarea
              id="admin-job-desc"
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste the job requirements..."
              className="min-h-[100px] resize-none"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="admin-date">Scheduled Date</Label>
              <Input
                id="admin-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={minDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-time">Scheduled Time</Label>
              <Input
                id="admin-time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !email || !jobDescription}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating & Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Create & Send Invitation
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
