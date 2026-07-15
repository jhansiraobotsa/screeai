import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FAST_MODEL = "claude-haiku-4-5";
const QUALITY_MODEL = "claude-sonnet-4-6";

/** Non-streaming call — used for follow_up and evaluate */
async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string, useQualityModel = false): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: useQualityModel ? QUALITY_MODEL : FAST_MODEL,
      max_tokens: useQualityModel ? 2048 : 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    if (response.status === 402) throw new Error("API credits depleted.");
    if (response.status === 401) throw new Error("Invalid Anthropic API key.");
    console.error("Claude API error:", response.status, errorText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

/** Streaming call — pipes Anthropic SSE directly to client */
async function callClaudeStream(systemPrompt: string, userPrompt: string, apiKey: string): Promise<Response> {
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
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    if (response.status === 402) throw new Error("API credits depleted.");
    if (response.status === 401) throw new Error("Invalid Anthropic API key.");
    throw new Error(`Claude API error: ${response.status}`);
  }

  // Pipe Anthropic's SSE stream directly to the client
  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      action,
      interviewId,
      candidateName,
      resumeText,
      questions,
      transcriptSoFar,
      currentQuestionIndex,
      anthropicApiKey: clientApiKey,
      stream: shouldStream,
    } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || clientApiKey;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "greet") {
      systemPrompt = `You are an AI interviewer named Alex. You are conducting a professional job interview.
Be warm, professional, and encouraging. Speak naturally as if in a real interview.
Keep responses concise (2-3 sentences max for greetings). Do not use markdown or bullet points — speak in natural flowing sentences.`;

      userPrompt = `Greet the candidate named "${candidateName}" warmly. Introduce yourself as Alex, the AI interviewer.
Let them know the interview will consist of ${questions?.length || "several"} questions and encourage them to take their time with answers.
${resumeText ? `You have reviewed their resume. Mention one positive thing you noticed about their background.` : ""}
${resumeText ? `Resume excerpt: ${resumeText.substring(0, 500)}` : ""}`;

    } else if (action === "ask_question") {
      systemPrompt = `You are an AI interviewer named Alex conducting a professional interview.
Be concise and natural. Ask one question at a time.
If this is not the first question, briefly acknowledge the candidate's previous answer before asking the next.
Keep your response to 2-4 sentences max. Do not use markdown — speak in natural sentences.`;

      const question = questions?.[currentQuestionIndex];
      const questionText = question?.text?.trim();
      userPrompt = `The candidate is ${candidateName}.
${resumeText ? `Resume context: ${resumeText.substring(0, 300)}` : ""}

Transcript so far:
${transcriptSoFar || "(Interview just started)"}

${questionText
  ? `Ask this question naturally (word it conversationally): "${questionText}"
${currentQuestionIndex > 0 ? "First briefly acknowledge their previous answer, then ask this question." : ""}`
  : `Ask an appropriate interview question based on the transcript and candidate's background. ${currentQuestionIndex > 0 ? "Briefly acknowledge their last answer first." : ""}`}`;

    } else if (action === "follow_up") {
      systemPrompt = `You are an AI interviewer named Alex. Based on the candidate's answer, decide if you should:
1. Ask a brief follow-up question (if the answer was vague, incomplete, or interesting enough to probe deeper)
2. Move on to the next question (if the answer was thorough)

Respond with ONLY a JSON object (no markdown, no explanation): { "should_follow_up": boolean, "response": "your follow-up question or brief transition to next topic" }
Keep responses to 1-2 sentences.`;

      const currQ = questions?.[currentQuestionIndex];
      userPrompt = `Candidate: ${candidateName}
${resumeText ? `Resume context: ${resumeText.substring(0, 300)}` : ""}

Current question: ${currQ?.text ? `"${currQ.text}"` : "(from transcript)"}
Recent transcript:
${transcriptSoFar?.split("\n").slice(-5).join("\n") || ""}

Should you ask a follow-up or move on? Respond with JSON only.`;

    } else if (action === "wrap_up") {
      systemPrompt = `You are an AI interviewer named Alex wrapping up an interview.
Be warm and professional. Thank the candidate and let them know what to expect next.
Keep it to 2-3 sentences. Do not use markdown — speak naturally.`;

      userPrompt = `Wrap up the interview with ${candidateName}. Thank them for their time and answers. Let them know the team will review the interview recording and transcript and get back to them soon.`;

    } else if (action === "evaluate") {
      systemPrompt = `You are an interview evaluator. Analyze the interview transcript and provide structured scoring.
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

      userPrompt = `Evaluate this interview transcript for candidate ${candidateName}:

${transcriptSoFar || "No transcript available"}

${resumeText ? `Resume: ${resumeText.substring(0, 500)}` : ""}`;

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    // Streaming path for conversational actions (greet, ask_question, wrap_up)
    const streamableActions = ["greet", "ask_question", "wrap_up"];
    if (shouldStream && streamableActions.includes(action)) {
      return await callClaudeStream(systemPrompt, userPrompt, ANTHROPIC_API_KEY);
    }

    // Non-streaming path (follow_up, evaluate, or stream=false)
    const useQuality = action === "evaluate";
    const content = await callClaude(systemPrompt, userPrompt, ANTHROPIC_API_KEY, useQuality);

    return new Response(JSON.stringify({ content, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("interview-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
