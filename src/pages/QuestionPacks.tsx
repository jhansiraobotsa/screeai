import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import QuestionPackDialog from "@/components/question-packs/QuestionPackDialog";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";

interface Question {
  id: string;
  text: string;
  order: number;
  type: string;
}

export default function QuestionPacks() {
  const [packs, setPacks] = useState<Tables<"question_packs">[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useProfile();

  const fetchPacks = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("question_packs")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false });
    setPacks(data || []);
    setLoading(false);
  }, [profile?.org_id]);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Packs</h1>
          <p className="text-muted-foreground mt-1">Create reusable question sets for interviews</p>
        </div>
        <QuestionPackDialog onCreated={fetchPacks} />
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : packs.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <Brain className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No question packs yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Create your first question pack to use in AI interviews. Questions will be asked by the AI interviewer.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack, i) => {
            const questions = (pack.questions as unknown as Question[]) || [];
            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{pack.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {questions.length} Q{questions.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {pack.role_target && (
                      <Badge variant="outline" className="w-fit text-xs">
                        {pack.role_target}
                      </Badge>
                    )}
                    {pack.description && (
                      <CardDescription className="line-clamp-2">
                        {pack.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {questions.slice(0, 3).map((q, qi) => (
                        <p key={q.id} className="text-sm text-muted-foreground truncate">
                          <span className="font-mono text-xs mr-1">{qi + 1}.</span>
                          {q.text}
                        </p>
                      ))}
                      {questions.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{questions.length - 3} more questions
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Created {format(new Date(pack.created_at), "MMM d, yyyy")}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
