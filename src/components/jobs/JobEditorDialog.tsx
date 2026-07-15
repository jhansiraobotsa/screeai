import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import RichTextEditor from "@/components/editor/RichTextEditor";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Tables<"jobs"> | null;
  categorySuggestions: string[];
  onSaved: () => void;
}

export default function JobEditorDialog({ open, onOpenChange, job, categorySuggestions, onSaved }: Props) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(job?.title || "");
      setCategory(job?.category || "");
      setLocation(job?.location || "");
      setEmploymentType(job?.employment_type || "");
      setExpiresAt(job?.expires_at || "");
      setDescriptionHtml(job?.description_html || "");
    }
  }, [open, job]);

  const save = async (status: "draft" | "published") => {
    if (!profile?.org_id || !user) return;
    if (!title.trim() || !category.trim()) {
      toast.error("Title and category are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        category: category.trim(),
        location: location.trim() || null,
        employment_type: employmentType.trim() || null,
        expires_at: expiresAt || null,
        description_html: descriptionHtml,
        status,
      };

      if (job) {
        const { error } = await supabase.from("jobs").update(payload).eq("id", job.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jobs").insert({
          ...payload,
          org_id: profile.org_id,
          created_by: user.id,
        });
        if (error) throw error;
      }

      toast.success(status === "published" ? "Job published" : "Draft saved");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "Edit Job" : "Create Job"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="job-title">Job Title *</Label>
            <Input
              id="job-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Senior Python Developer"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="job-category">Category / Role *</Label>
              <Input
                id="job-category"
                list="job-category-suggestions"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Python Developer"
              />
              <datalist id="job-category-suggestions">
                {categorySuggestions.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Used to auto-match tagged candidates to this role.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-type">Employment Type</Label>
              <Input
                id="job-type"
                value={employmentType}
                onChange={e => setEmploymentType(e.target.value)}
                placeholder="e.g. Full-time"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="job-location">Location</Label>
              <Input
                id="job-location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Remote / Hyderabad"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-expiry">Expiry Date</Label>
              <Input
                id="job-expiry"
                type="date"
                value={expiresAt}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                After this date the job is hidden from candidates. Leave blank for no expiry.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => save("draft")} disabled={saving}>
              Save Draft
            </Button>
            <Button variant="gradient" onClick={() => save("published")} disabled={saving}>
              {saving ? "Saving..." : "Publish"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}