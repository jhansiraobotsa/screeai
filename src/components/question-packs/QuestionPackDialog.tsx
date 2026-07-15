import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  onCreated: () => void;
}

export default function QuestionPackDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleTarget, setRoleTarget] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const { profile } = useProfile();
  const { user } = useAuth();

  const addQuestion = () => setQuestions([...questions, ""]);
  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };
  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.org_id || !user) {
      toast.error("You must belong to an organization");
      return;
    }

    const validQuestions = questions.filter(q => q.trim());
    if (validQuestions.length === 0) {
      toast.error("Add at least one question");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("question_packs").insert({
        title,
        description: description || null,
        role_target: roleTarget || null,
        org_id: profile.org_id,
        created_by: user.id,
        questions: validQuestions.map((q, i) => ({
          id: crypto.randomUUID(),
          text: q,
          order: i,
          type: "behavioral",
        })),
      });

      if (error) throw error;

      toast.success("Question pack created");
      setOpen(false);
      setTitle("");
      setDescription("");
      setRoleTarget("");
      setQuestions([""]);
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
          New Question Pack
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Question Pack</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Senior Engineer Interview"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Target Role</Label>
              <Input
                value={roleTarget}
                onChange={e => setRoleTarget(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Questions focused on system design and problem solving..."
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Questions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="h-3 w-3 mr-1" /> Add Question
              </Button>
            </div>
            {questions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-mono">
                  {i + 1}
                </span>
                <Input
                  value={q}
                  onChange={e => updateQuestion(i, e.target.value)}
                  placeholder="Enter your interview question..."
                  className="flex-1"
                />
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(i)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? "Creating..." : "Create Pack"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
