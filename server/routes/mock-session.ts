import { Router } from "express";
import { supabase } from "../supabase.js";
import { getOrSet, invalidatePattern, TTL } from "../redis.js";

const router = Router();

// POST /api/mock-session — Create a new mock session
router.post("/", async (req, res) => {
  const {
    userId, orgId, resumeUrl, resumeText,
    jobDescription, jobTitle, questions,
    scheduledAt, createdBy,
  } = req.body;

  if (!userId || !jobDescription) {
    return res.status(400).json({ error: "userId and jobDescription are required" });
  }

  const { data, error } = await supabase
    .from("mock_sessions")
    .insert({
      user_id: userId,
      org_id: orgId || null,
      resume_url: resumeUrl || null,
      resume_text: resumeText || null,
      job_description: jobDescription,
      job_title: jobTitle || null,
      questions: questions || [],
      scheduled_at: scheduledAt || null,
      status: questions?.length ? "questions_generated" : "pending",
      created_by: createdBy || userId,
    })
    .select()
    .single();

  if (error) {
    console.error("[MockSession] Create error:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// GET /api/mock-session/:id — Get session details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const data = await getOrSet(`mock_session:${id}`, TTL.INTERVIEWS, async () => {
    const { data: session } = await supabase
      .from("mock_sessions")
      .select("*")
      .eq("id", id)
      .single();
    return session;
  });

  if (!data) return res.status(404).json({ error: "Session not found" });
  res.json(data);
});

// GET /api/mock-session/user/:userId — Get all sessions for a user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from("mock_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[MockSession] Fetch error:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data || []);
});

// POST /api/mock-session/:id/start — Create interview from session & start
router.post("/:id/start", async (req, res) => {
  const { id } = req.params;

  // 1. Fetch mock session
  const { data: session, error: sessionError } = await supabase
    .from("mock_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (sessionError || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.interview_id) {
    // Already has an interview — return it
    return res.json({ interviewId: session.interview_id });
  }

  // 2. Get user profile for org_id and name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, org_id")
    .eq("user_id", session.user_id)
    .single();

  const orgId = session.org_id || profile?.org_id;
  if (!orgId) {
    return res.status(400).json({ error: "User has no organization" });
  }

  // 3. Create candidate entry from user profile
  const { data: candidate, error: candError } = await supabase
    .from("candidates")
    .insert({
      org_id: orgId,
      full_name: profile?.full_name || "Mock User",
      email: `mock-${session.user_id}@screen.ai`,
      resume_url: session.resume_url,
      resume_text: session.resume_text,
      created_by: session.user_id,
    })
    .select()
    .single();

  if (candError) {
    console.error("[MockSession] Candidate create error:", candError);
    return res.status(500).json({ error: candError.message });
  }

  // 4. Create question pack from session questions
  const { data: qp, error: qpError } = await supabase
    .from("question_packs")
    .insert({
      org_id: orgId,
      title: `Mock: ${session.job_title || "Interview"}`,
      description: `Auto-generated for mock session`,
      role_target: session.job_title || null,
      questions: session.questions,
      created_by: session.user_id,
    })
    .select()
    .single();

  if (qpError) {
    console.error("[MockSession] QP create error:", qpError);
    return res.status(500).json({ error: qpError.message });
  }

  // 5. Create interview
  const { data: interview, error: ivError } = await supabase
    .from("interviews")
    .insert({
      org_id: orgId,
      candidate_id: candidate.id,
      question_pack_id: qp.id,
      interviewer_id: session.user_id,
      status: "created",
      mock_session_id: session.id,
      scheduled_at: session.scheduled_at,
    })
    .select()
    .single();

  if (ivError) {
    console.error("[MockSession] Interview create error:", ivError);
    return res.status(500).json({ error: ivError.message });
  }

  // 6. Link interview to session
  await supabase
    .from("mock_sessions")
    .update({ interview_id: interview.id, status: "live" })
    .eq("id", id);

  // Invalidate caches
  await invalidatePattern(`org:${orgId}:*`);

  res.json({ interviewId: interview.id });
});

// PUT /api/mock-session/:id — Update session (reschedule, etc.)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from("mock_sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[MockSession] Update error:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

export default router;
