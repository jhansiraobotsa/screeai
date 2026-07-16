import { Router } from "express";
import { supabase } from "../supabase.js";
import { computeInterviewCost } from "../costRates.js";

const router = Router();

// POST /api/costs/record — compute + store the estimated cost of an interview.
// Body: { interviewId, durationSeconds? }. If durationSeconds is omitted, it's
// derived from the interview's started_at/ended_at.
router.post("/record", async (req, res) => {
  const { interviewId } = req.body as { interviewId?: string; durationSeconds?: number };
  let { durationSeconds } = req.body as { durationSeconds?: number };
  if (!interviewId) return res.status(400).json({ error: "interviewId is required" });

  try {
    // Fall back to started_at/ended_at if duration not provided.
    if (typeof durationSeconds !== "number" || durationSeconds <= 0) {
      const { data: iv } = await supabase
        .from("interviews")
        .select("started_at, ended_at")
        .eq("id", interviewId)
        .single();
      if (iv?.started_at && iv?.ended_at) {
        durationSeconds = Math.max(
          0,
          Math.round((new Date(iv.ended_at).getTime() - new Date(iv.started_at).getTime()) / 1000)
        );
      } else {
        durationSeconds = 0;
      }
    }

    const cost = computeInterviewCost(durationSeconds);

    const { error } = await supabase.rpc("record_interview_cost", {
      p_interview_id: interviewId,
      p_duration_seconds: cost.durationSeconds,
      p_voice: cost.voiceCost,
      p_transcription: cost.transcriptionCost,
      p_claude: cost.claudeCost,
      p_total: cost.totalCost,
      p_breakdown: cost.detail,
    });
    if (error) {
      console.error("[Costs] record failed:", error.message);
      return res.status(500).json({ error: "Failed to record cost" });
    }

    res.json({ ok: true, cost });
  } catch (err) {
    console.error("[Costs] record error:", err);
    res.status(500).json({ error: "Failed to record cost" });
  }
});

export default router;