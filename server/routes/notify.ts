import { Router } from "express";
import { supabase } from "../supabase.js";
import { createNotification, notifyOrgUsers } from "../notify.js";

const router = Router();

// POST /api/notify/job-published — notify all org users of a new position.
// Body: { jobId }
router.post("/job-published", async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: "jobId is required" });
  try {
    const { data: job } = await supabase
      .from("jobs")
      .select("org_id, title, status")
      .eq("id", jobId)
      .single();
    if (!job || job.status !== "published") {
      return res.json({ notified: 0 }); // only notify for published jobs
    }
    await notifyOrgUsers({
      orgId: job.org_id,
      type: "job_published",
      title: `New position: ${job.title}`,
      body: "A new job opening is available. Check Open Positions.",
      link: "/spaces",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[Notify] job-published error:", err);
    res.status(500).json({ error: "Failed to notify" });
  }
});

// POST /api/notify/status-changed — notify an applicant of a status change.
// Body: { applicationId, status }
router.post("/status-changed", async (req, res) => {
  const { applicationId, status } = req.body;
  if (!applicationId || !status) return res.status(400).json({ error: "applicationId and status are required" });
  try {
    const { data: app } = await supabase
      .from("job_applications")
      .select("email, jobs(org_id, title)")
      .eq("id", applicationId)
      .single();
    if (!app?.email) return res.json({ ok: true });
    const job = app.jobs as unknown as { org_id: string; title: string } | null;
    const labels: Record<string, string> = {
      reviewing: "Your application is under review",
      shortlisted: "You've been shortlisted!",
      rejected: "Update on your application",
      applied: "Application received",
    };
    await createNotification({
      orgId: job?.org_id ?? null,
      recipientEmail: app.email,
      type: "status_changed",
      title: labels[status] || "Application status updated",
      body: job?.title ? `Role: ${job.title}` : undefined,
      link: "/spaces",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[Notify] status-changed error:", err);
    res.status(500).json({ error: "Failed to notify" });
  }
});

// POST /api/notify/interview-completed — notify the org's admins.
// Body: { interviewId }
router.post("/interview-completed", async (req, res) => {
  const { interviewId } = req.body;
  if (!interviewId) return res.status(400).json({ error: "interviewId is required" });
  try {
    const { data: iv } = await supabase
      .from("interviews")
      .select("org_id, candidates(full_name, email)")
      .eq("id", interviewId)
      .single();
    if (!iv?.org_id) return res.json({ ok: true });
    const cand = iv.candidates as unknown as { full_name: string; email: string } | null;

    // Notify every admin in the org.
    const { data: admins } = await supabase.rpc("org_admin_emails", { p_org_id: iv.org_id });
    for (const row of (admins as { email: string }[] | null) ?? []) {
      await createNotification({
        orgId: iv.org_id,
        recipientEmail: row.email,
        type: "interview_completed",
        title: "Interview completed",
        body: `${cand?.full_name || "A candidate"} finished their interview.`,
        link: "/interviews",
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[Notify] interview-completed error:", err);
    res.status(500).json({ error: "Failed to notify" });
  }
});

export default router;