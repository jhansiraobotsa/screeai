import { resolve, basename } from "path";
import { supabase } from "./supabase.js";
import { extractResumeText } from "./resumeParser.js";

const SCORING_MODEL = "claude-haiku-4-5-20251001";
const UPLOAD_DIR = resolve(process.cwd(), "server/uploads/resumes");

function getAnthropicKey(): string | undefined {
  return process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
}

function resumeDiskPath(resumeUrl: string): string | null {
  const name = basename(resumeUrl);
  if (!name) return null;
  const p = resolve(UPLOAD_DIR, name);
  return p.startsWith(UPLOAD_DIR) ? p : null;
}

export interface ScoreResult {
  scored: boolean;
  score?: number;
  reasoning?: string;
  reason?: string; // why not scored
}

// Score a single application: load it (past RLS via RPC), extract resume text,
// ask Claude for a 0-100 match, and persist. Throws on transient/unexpected
// errors so the queue can retry; returns {scored:false} for permanent skips
// (e.g. unreadable resume).
export async function scoreApplication(applicationId: string): Promise<ScoreResult> {
  const { data: rows, error: fetchErr } = await supabase.rpc("get_application_for_scoring", {
    app_id: applicationId,
  });
  if (fetchErr) throw new Error(`load application failed: ${fetchErr.message}`);

  const app = Array.isArray(rows) ? rows[0] : rows;
  if (!app) throw new Error("Application not found");

  const job = {
    title: app.job_title,
    category: app.job_category,
    description_html: app.job_description_html || "",
  };

  let resumeText: string | null = app.resume_text;
  if (!resumeText && app.resume_url) {
    const diskPath = resumeDiskPath(app.resume_url);
    if (diskPath) resumeText = await extractResumeText(diskPath);
  }
  if (!resumeText) {
    return { scored: false, reason: "Could not extract resume text" };
  }

  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const jobDescription = job.description_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const systemPrompt =
    "You are an expert technical recruiter. Compare a candidate's resume to a job posting and rate how well the candidate matches the role. " +
    "Respond ONLY with a JSON object of the form {\"score\": <integer 0-100>, \"reasoning\": \"<2-3 sentence explanation>\"}. " +
    "Score 0 = no relevant fit, 100 = perfect fit. Base it on skills, experience, and role alignment.";

  const userContent =
    `JOB TITLE: ${job.title}\nJOB CATEGORY: ${job.category}\n\nJOB DESCRIPTION:\n${jobDescription}\n\n` +
    `CANDIDATE RESUME:\n${resumeText.slice(0, 12000)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: SCORING_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    // Throw so the queue retries (rate limits, transient API errors).
    throw new Error(`Claude scoring error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  let score: number | null = null;
  let reasoning = "";
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
      reasoning = String(parsed.reasoning || "");
    } catch {
      // fall through
    }
  }
  if (score === null || Number.isNaN(score)) {
    throw new Error("Could not parse score from model output");
  }

  const { error: rpcError } = await supabase.rpc("set_application_score", {
    app_id: applicationId,
    p_score: score,
    p_reasoning: reasoning,
    p_resume_text: resumeText,
  });
  if (rpcError) throw new Error(`save score failed: ${rpcError.message}`);

  return { scored: true, score, reasoning };
}