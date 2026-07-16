// Estimated per-unit rates for AI/API cost calculation (USD).
// These are approximate published rates — update when prices change.
// All resulting figures are ESTIMATES, not exact billing.

export const RATES = {
  // OpenAI Realtime voice: blended $/minute for audio in+out.
  // Realtime audio is billed per token; this is a practical per-minute estimate.
  // gpt-realtime-mini rates ($10/1M in, $20/1M out) — ~1/3 of the full model.
  // (Full gpt-realtime-2 would be ~0.30/min; mini ≈ ~0.10/min blended.)
  openaiRealtimePerMinute: 0.10,

  // OpenAI input transcription (gpt-4o-transcribe) $/minute.
  openaiTranscribePerMinute: 0.006,

  // Deepgram nova-2 streaming $/minute.
  deepgramPerMinute: 0.0059,

  // Claude token rates ($ per 1M tokens).
  claude: {
    // Haiku 4.5 — used for conversational turns during the interview.
    haikuInputPerM: 1.0,
    haikuOutputPerM: 5.0,
    // Sonnet — used for the final evaluation.
    sonnetInputPerM: 3.0,
    sonnetOutputPerM: 15.0,
  },

  // Estimation assumptions for the conversational Claude cost (edge function
  // tokens aren't captured yet). Rough per-interview averages.
  estimate: {
    turnsPerInterview: 12,          // ~1 per question + follow-ups
    avgInputTokensPerTurn: 1200,    // system prompt + transcript context
    avgOutputTokensPerTurn: 120,    // short spoken responses
    evalInputTokens: 4000,          // full transcript for evaluation
    evalOutputTokens: 800,          // scores + summary
  },
};

export interface CostBreakdown {
  durationSeconds: number;
  voiceCost: number;
  transcriptionCost: number;
  claudeCost: number;
  totalCost: number;
  detail: Record<string, number>;
}

// Compute the estimated cost of a single interview from its duration.
// Voice + transcription are duration-based (accurate basis); Claude is estimated
// from average turn/token assumptions.
export function computeInterviewCost(durationSeconds: number): CostBreakdown {
  const minutes = Math.max(0, durationSeconds) / 60;

  const voiceCost = minutes * RATES.openaiRealtimePerMinute;
  const transcriptionCost =
    minutes * (RATES.openaiTranscribePerMinute + RATES.deepgramPerMinute);

  const e = RATES.estimate;
  const turnInput = e.turnsPerInterview * e.avgInputTokensPerTurn;
  const turnOutput = e.turnsPerInterview * e.avgOutputTokensPerTurn;
  const turnsCost =
    (turnInput / 1e6) * RATES.claude.haikuInputPerM +
    (turnOutput / 1e6) * RATES.claude.haikuOutputPerM;
  const evalCost =
    (e.evalInputTokens / 1e6) * RATES.claude.sonnetInputPerM +
    (e.evalOutputTokens / 1e6) * RATES.claude.sonnetOutputPerM;
  const claudeCost = turnsCost + evalCost;

  const round = (n: number) => Math.round(n * 10000) / 10000;
  const voice = round(voiceCost);
  const transcription = round(transcriptionCost);
  const claude = round(claudeCost);
  const total = round(voice + transcription + claude);

  return {
    durationSeconds: Math.max(0, durationSeconds),
    voiceCost: voice,
    transcriptionCost: transcription,
    claudeCost: claude,
    totalCost: total,
    detail: {
      minutes: Math.round(minutes * 100) / 100,
      conversationCost: round(turnsCost),
      evaluationCost: round(evalCost),
    },
  };
}