import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  fullName: string;
  categorySuggestions?: string[];
  onChanged?: () => void;
}

export default function TagCandidateDialog({
  open, onOpenChange, email, fullName, categorySuggestions = [], onChanged,
}: Props) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [tags, setTags] = useState<Tables<"candidate_tags">[]>([]);
  const [newTag, setNewTag] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!open || !email) return;
    setLoading(true);
    const { data } = await supabase
      .from("candidate_tags")
      .select("*")
      .eq("email", email.toLowerCase())
      .order("created_at", { ascending: false });
    setTags(data || []);
    setLoading(false);
  }, [open, email]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const addTag = async () => {
    if (!profile?.org_id || !user || !newTag.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("candidate_tags").insert({
      org_id: profile.org_id,
      email: email.toLowerCase(),
      full_name: fullName || null,
      tag: newTag.trim(),
      experience_level: experience.trim() || null,
      created_by: user.id,
    });
    setAdding(false);
    if (error) {
      toast.error(error.code === "23505" ? "That tag already exists" : error.message);
    } else {
      setNewTag("");
      setExperience("");
      fetchTags();
      onChanged?.();
    }
  };

  const removeTag = async (id: string) => {
    const { error } = await supabase.from("candidate_tags").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { fetchTags(); onChanged?.(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag {fullName || email}</DialogTitle>
          <DialogDescription>
            Tag this person by role so they auto-surface for future matching jobs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Tags</Label>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                    {t.tag}{t.experience_level ? ` · ${t.experience_level}` : ""}
                    <button onClick={() => removeTag(t.id)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <Label htmlFor="new-tag">Add a Role Tag</Label>
            <Input
              id="new-tag"
              list="tag-suggestions"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="e.g. PHP Developer"
            />
            <datalist id="tag-suggestions">
              {categorySuggestions.map(c => <option key={c} value={c} />)}
            </datalist>
            <Input
              value={experience}
              onChange={e => setExperience(e.target.value)}
              placeholder="Experience level (optional) — e.g. Senior"
            />
            <Button onClick={addTag} disabled={adding || !newTag.trim()} className="w-full mt-1">
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Tag
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}