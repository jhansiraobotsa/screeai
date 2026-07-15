import { supabase } from "./supabase.js";

const MODEL = "claude-sonnet-5";

function getAnthropicKey(): string | undefined {
  return process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
}

export interface QGenResult {
  count: number;
}

// Generate EXACTLY 10 interview questions deeply grounded in this candidate's
// resume (and the job they applied to), then save them on the interview.
export async function generateInterviewQuestions(interviewId: string): Promise<QGenResult> {
  const { data: rows, error } = await supabase.rpc("get_interview_for_qgen", { iv_id: interviewId });
  if (error) throw new Error(`load interview failed: ${error.message}`);
  const iv = Array.isArray(rows) ? rows[0] : rows;
  if (!iv) throw new Error("Interview not found");

  const resumeText: string = iv.resume_text || "";
  if (!resumeText.trim()) {
    // No resume to base questions on. This is permanent (not transient), so
    // return instead of throwing — retrying can't help and just spams logs.
    console.warn(`[questionGen] no resume text for interview ${interviewId}; skipping`);
    return { count: 0 };
  }

  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const jobDescription = (iv.job_description_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const systemPrompt =
    "You are an expert technical interviewer. Generate EXACTLY 10 interview questions that are deeply grounded in THIS candidate's resume — probe their specific projects, roles, technologies, and decisions. " +
    "Tie questions to the target job where relevant. " +
    "RULES:\n" +
    "- EXACTLY 10 questions, no more, no fewer.\n" +
    "- Each question must reference something concrete from the resume (a project, skill, company, or claim) so it can't be generic.\n" +
    "- Progress from warm-up to deep/challenging.\n" +
    "- Mix behavioral, technical, and situational.\n" +
    "- Return ONLY a valid JSON array, no markdown, of the form:\n" +
    '[{"id":"1","text":"...","order":1,"type":"behavioral"}]';

  const userContent =
    `TARGET JOB: ${iv.job_title || "Not specified"} (${iv.job_category || "n/a"})\n\n` +
    `JOB DESCRIPTION:\n${jobDescription || "Not specified"}\n\n` +
    `CANDIDATE: ${iv.candidate_name || "Candidate"}\n` +
    `CANDIDATE RESUME:\n${resumeText.slice(0, 12000)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude question-gen error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  // Sonnet 5 may return a leading "thinking" block; grab the text block(s).
  const raw = (data.content || [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n") || "[]";
  const match = raw.match(/\[[\s\S]*\]/);
  let questions: unknown[] = [];
  if (match) {
    try { questions = JSON.parse(match[0]); } catch { /* fall through */ }
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Could not parse questions from model output");
  }

  // Enforce the hard cap of exactly 10 (trim extras; if fewer, keep what we got).
  const trimmed = questions.slice(0, 10).map((q: any, i: number) => ({
    id: String(q.id ?? i + 1),
    text: String(q.text ?? ""),
    order: i + 1,
    type: String(q.type ?? "general"),
  })).filter(q => q.text);

  const { error: saveErr } = await supabase.rpc("set_interview_questions", {
    iv_id: interviewId,
    p_questions: trimmed,
  });
  if (saveErr) throw new Error(`save questions failed: ${saveErr.message}`);

  return { count: trimmed.length };
}