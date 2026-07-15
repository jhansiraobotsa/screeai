import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

interface Suggested {
  email: string;
  fullName: string | null;
  tags: { tag: string; experience_level: string | null }[];
  resumeUrl: string | null;
  applied: boolean;
}

// Shows tagged people whose tag matches this job's category, who have NOT
// already applied to this job.
export default function SuggestedFromTags({ jobId, category }: { jobId: string; category: string }) {
  const { session } = useAuth();
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    // Tags matching this job's category (case-insensitive).
    const { data: tagRows } = await supabase
      .from("candidate_tags")
      .select("email, full_name, tag, experience_level")
      .ilike("tag", category);

    const byEmail = new Map<string, Suggested>();
    (tagRows || []).forEach(t => {
      const key = t.email.toLowerCase();
      if (!byEmail.has(key)) {
        byEmail.set(key, { email: key, fullName: t.full_name, tags: [], resumeUrl: null, applied: false });
      }
      byEmail.get(key)!.tags.push({ tag: t.tag, experience_level: t.experience_level });
    });

    const emails = Array.from(byEmail.keys());
    if (emails.length) {
      // Who already applied to THIS job (to exclude), and most-recent resume anywhere.
      const { data: apps } = await supabase
        .from("job_applications")
        .select("email, job_id, resume_url, created_at")
        .in("email", emails)
        .order("created_at", { ascending: false });
      (apps || []).forEach(a => {
        const s = byEmail.get(a.email.toLowerCase());
        if (!s) return;
        if (a.job_id === jobId) s.applied = true;
        if (!s.resumeUrl && a.resume_url) s.resumeUrl = a.resume_url;
      });
    }

    // Exclude anyone who already applied to this job.
    setSuggested(Array.from(byEmail.values()).filter(s => !s.applied));
    setLoading(false);
  }, [jobId, category]);

  useEffect(() => { fetch(); }, [fetch]);

  const openResume = (url: string) => {
    window.open(`${url}?token=${encodeURIComponent(session?.access_token || "")}`, "_blank");
  };

  if (loading || suggested.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        <Sparkles className="h-3.5 w-3.5" />
        Suggested from tags ({suggested.length})
      </h3>
      <p className="text-xs text-muted-foreground">
        People tagged as "{category}" who haven't applied to this job.
      </p>
      <div className="grid gap-2">
        {suggested.map(s => (
          <Card key={s.email} className="border-dashed">
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{s.fullName || s.email}</p>
                <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.tags.map(t => (
                    <Badge key={t.tag} variant="secondary" className="text-[11px]">
                      {t.tag}{t.experience_level ? ` · ${t.experience_level}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
              {s.resumeUrl && (
                <Button variant="outline" size="sm" onClick={() => openResume(s.resumeUrl!)}>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Resume
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}