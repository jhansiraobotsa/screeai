import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2 } from "lucide-react";

interface Question {
  id: string;
  text: string;
  order: number;
  type: string;
}

interface QuestionReviewProps {
  questions: Question[];
  onRegenerate: () => void;
  onConfirm: () => void;
  regenerating: boolean;
}

const typeColors: Record<string, string> = {
  behavioral: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  technical: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  situational: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export default function QuestionReview({ questions, onRegenerate, onConfirm, regenerating }: QuestionReviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Your 10 Interview Questions</h3>
          <p className="text-sm text-muted-foreground">Review and confirm your personalized questions</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerating ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
      </div>

      <div className="space-y-2.5">
        {questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-3 rounded-lg border p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed">{q.text}</p>
              <Badge variant="outline" className={`mt-1.5 text-[10px] capitalize ${typeColors[q.type] || ""}`}>
                {q.type}
              </Badge>
            </div>
          </motion.div>
        ))}
      </div>

      <Button onClick={onConfirm} className="w-full" variant="gradient">
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Looks Good — Continue
      </Button>
    </div>
  );
}
