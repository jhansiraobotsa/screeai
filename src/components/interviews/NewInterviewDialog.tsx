import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  onCreated: () => void;
}

export default function NewInterviewDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [questionPackId, setQuestionPackId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [candidates, setCandidates] = useState<Tables<"candidates">[]>([]);
  const [questionPacks, setQuestionPacks] = useState<Tables<"question_packs">[]>([]);
  const { profile } = useProfile();
  const { user } = useAuth();

  useEffect(() => {
    if (!open || !profile?.org_id) return;

    const fetchData = async () => {
      const [candidatesRes, packsRes] = await Promise.all([
        supabase.from("candidates").select("*").eq("org_id", profile.org_id!).order("created_at", { ascending: false }),
        supabase.from("question_packs").select("*").eq("org_id", profile.org_id!).order("created_at", { ascending: false }),
      ]);
      setCandidates(candidatesRes.data || []);
      setQuestionPacks(packsRes.data || []);
    };

    fetchData();
  }, [open, profile?.org_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.org_id || !user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("interviews")
        .insert({
          candidate_id: candidateId,
          org_id: profile.org_id,
          interviewer_id: user.id,
          question_pack_id: questionPackId || null,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          status: "created",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Interview created successfully");

      if (sendInvite) {
        try {
          const emailRes = await fetch("/api/email/send-candidate-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ interviewId: data.id }),
          });
          const emailData = await emailRes.json();
          if (!emailRes.ok) throw new Error(emailData.error);
          toast.success("Invitation email sent to candidate");
        } catch (emailErr: any) {
          toast.error(`Interview created, but email failed to send: ${emailErr.message}`);
        }
      }

      setOpen(false);
      setCandidateId("");
      setQuestionPackId("");
      setScheduledAt("");
      setSendInvite(true);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient">
          <Plus className="h-4 w-4 mr-2" />
          New Interview
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule New Interview</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Candidate *</Label>
            <Select value={candidateId} onValueChange={setCandidateId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a candidate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name} ({c.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No candidates found. Add a candidate first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Question Pack</Label>
            <Select value={questionPackId} onValueChange={setQuestionPackId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a question pack (optional)" />
              </SelectTrigger>
              <SelectContent>
                {questionPacks.map(qp => (
                  <SelectItem key={qp.id} value={qp.id}>
                    {qp.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scheduled Date & Time</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="send-invite"
              checked={sendInvite}
              onCheckedChange={checked => setSendInvite(checked === true)}
            />
            <Label htmlFor="send-invite" className="font-normal cursor-pointer">
              Email the invite link to the candidate
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={loading || !candidateId}>
              {loading ? "Creating..." : "Create Interview"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
