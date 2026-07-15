import { Router } from "express";

const router = Router();

// POST /api/questions/generate — AI generates exactly 10 interview questions
router.post("/generate", async (req, res) => {
  const { resumeText, jobDescription, jobTitle } = req.body;

  if (!jobDescription) {
    return res.status(400).json({ error: "jobDescription is required" });
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        system: `You are an expert interview coach. Generate exactly 10 interview questions tailored to the candidate's resume and the job they are applying for.

RULES:
- Generate EXACTLY 10 questions, no more, no less
- Mix of types: 3-4 behavioral, 3-4 technical/role-specific, 2-3 situational
- Questions should be specific to the candidate's background and the job requirements
- Questions should progress from introductory to more challenging
- Return ONLY a valid JSON array, no other text or markdown

Return format:
[
  { "id": "1", "text": "question text here", "order": 1, "type": "behavioral" },
  { "id": "2", "text": "question text here", "order": 2, "type": "technical" }
]`,
        messages: [
          {
            role: "user",
            content: `Generate 10 interview questions for this candidate and role:

JOB TITLE: ${jobTitle || "Not specified"}
JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText?.substring(0, 3000) || "No resume provided"}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Questions] Claude API error:", response.status, err);
      return res.status(500).json({ error: "Failed to generate questions" });
    }

    const data = await response.json();
    // Sonnet 5 may lead with a "thinking" block; use the text block(s).
    const content = (data.content || [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || "[]";

    // Extract JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    const questions = match ? JSON.parse(match[0]) : [];

    res.json({ questions });
  } catch (error) {
    console.error("[Questions] Generation error:", error);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

export default router;
