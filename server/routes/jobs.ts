import { Router } from "express";
import { supabase } from "../supabase.js";
import { enqueueScoring, enqueueQuestionGen } from "../queue.js";

const router = Router();

const PORT = 3001;

// POST /api/jobs/invite-applicants — for each selected application, create an
// interview (find/create candidate), email the interview link, and enqueue
// resume-based question generation. Body: { applicationIds: string[] }.
router.post("/invite-applicants", async (req, res) => {
  const { applicationIds } = req.body as { applicationIds?: string[] };
  if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
    return res.status(400).json({ error: "applicationIds is required" });
  }

  const results: { applicationId: string; ok: boolean; error?: string }[] = [];

  for (const appId of applicationIds) {
    try {
      const { data: rows, error } = await supabase.rpc("create_interview_from_application", {
        app_id: appId,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row?.interview_id) throw new Error("Could not create interview");

      // Enqueue resume-based question generation for this interview.
      await enqueueQuestionGen(row.interview_id);

      // Email the interview link (reuse the existing candidate-invite endpoint).
      const emailRes = await fetch(`http://localhost:${PORT}/api/email/send-candidate-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: row.interview_id }),
      });
      if (!emailRes.ok) {
        const e = await emailRes.json().catch(() => ({}));
        throw new Error(e.error || "Email failed");
      }

      results.push({ applicationId: appId, ok: true });
    } catch (err: any) {
      console.error("[Jobs] invite-applicant failed:", appId, err.message);
      results.push({ applicationId: appId, ok: false, error: err.message });
    }
  }

  const sent = results.filter(r => r.ok).length;
  res.json({ sent, total: applicationIds.length, results });
});

// POST /api/jobs/score-application — enqueue a background scoring job for an
// application. Returns immediately; the worker extracts the resume, scores it
// against the job via Claude, and saves the result (with retries).
// Used both right after apply and for manual re-score.
router.post("/score-application", async (req, res) => {
  const { applicationId } = req.body;
  if (!applicationId) return res.status(400).json({ error: "applicationId is required" });

  try {
    await enqueueScoring(applicationId);
    res.json({ queued: true });
  } catch (err) {
    console.error("[Jobs] enqueue scoring error:", err);
    res.status(500).json({ error: "Failed to queue scoring" });
  }
});

export default router;