import { Router } from "express";

const router = Router();

const FAST_MODEL = "claude-haiku-4-5-20251001";
const QUALITY_MODEL = "claude-sonnet-5";

function getAnthropicKey(): string | undefined {
  return process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
}

// POST /api/ai/respond — Generate AI interviewer response via Claude Haiku
// Pass stream:true in body to get SSE streaming response
router.post("/respond", async (req, res) => {
  const { messages, systemPrompt, stream: shouldStream } = req.body;

  if (!messages || !systemPrompt) {
    return res.status(400).json({ error: "messages and systemPrompt are required" });
  }

  const apiKey = getAnthropicKey();
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
        model: FAST_MODEL,
        max_tokens: 512,
        ...(shouldStream ? { stream: true } : {}),
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Route] Claude error:", response.status, errorText);
      if (response.status === 429) return res.status(429).json({ error: "Rate limit exceeded. Please try again shortly." });
      if (response.status === 402) return res.status(402).json({ error: "API credits depleted." });
      return res.status(response.status).json({ error: `Claude API error: ${response.status}` });
    }

    if (shouldStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const reader = (response.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.writableEnded) {
            res.write(decoder.decode(value, { stream: true }));
            if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
              (res as unknown as { flush: () => void }).flush();
            }
          }
        }
      } finally {
        if (!res.writableEnded) res.end();
      }
      return;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    res.json({ text });
  } catch (err) {
    console.error("[AI Route] respond error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate AI response" });
  }
});

// POST /api/ai/evaluate — Score interview with Claude Sonnet
router.post("/evaluate", async (req, res) => {
  const { transcript, candidateName, resumeText, questions } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "transcript is required" });
  }

  const apiKey = getAnthropicKey();
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  const systemPrompt = `You are an interview evaluator. Analyze the interview transcript and provide structured scoring.
Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "scores": [
    { "dimension": "Communication", "score": 1, "evidence": "brief evidence" },
    { "dimension": "Technical Knowledge", "score": 1, "evidence": "brief evidence" },
    { "dimension": "Problem Solving", "score": 1, "evidence": "brief evidence" },
    { "dimension": "Cultural Fit", "score": 1, "evidence": "brief evidence" },
    { "dimension": "Overall", "score": 1, "evidence": "brief summary" }
  ],
  "summary": "2-3 sentence overall assessment"
}
Scores are integers from 1-10. Return JSON only, no other text.`;

  const userPrompt = `Evaluate this interview transcript for candidate ${candidateName}:

${transcript}

${resumeText ? `Resume: ${resumeText.substring(0, 500)}` : ""}
${questions?.length ? `Questions asked: ${questions.map((q: { text: string }) => q.text).join("; ")}` : ""}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: QUALITY_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Route] evaluate error:", response.status, errorText);
      return res.status(response.status).json({ error: `Evaluation failed: ${response.status}` });
    }

    const data = await response.json();
    // Sonnet 5 may lead with a "thinking" block; use the text block(s).
    const text = (data.content || [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || "";

    try {
      const parsed = JSON.parse(text);
      res.json({ content: text, scores: parsed.scores, summary: parsed.summary });
    } catch {
      res.json({ content: text });
    }
  } catch (err) {
    console.error("[AI Route] evaluate error:", err);
    res.status(500).json({ error: "Failed to evaluate interview" });
  }
});

export default router;
