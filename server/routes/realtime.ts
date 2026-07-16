import { Router } from "express";

const router = Router();

function getApiKey(): string | null {
  return process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || null;
}

// POST /api/realtime/connect — proxy SDP exchange so we can capture call_id for hangup
router.post("/connect", async (req, res) => {
  const { sdp, ephemeralKey } = req.body as { sdp?: string; ephemeralKey?: string };
  if (!sdp || !ephemeralKey) {
    return res.status(400).json({ error: "sdp and ephemeralKey are required" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
    });

    const answerSdp = await response.text();
    const callId = response.headers.get("location")?.split("/").pop() ?? null;

    if (!response.ok) {
      console.error("[Realtime] Connect error:", response.status, answerSdp);
      return res.status(response.status).json({ error: answerSdp, callId });
    }

    res.json({ sdp: answerSdp, callId });
  } catch (error) {
    console.error("[Realtime] Connect proxy error:", error);
    res.status(500).json({ error: "Failed to establish realtime call" });
  }
});

// POST /api/realtime/hangup — end an active OpenAI Realtime call server-side
router.post("/hangup", async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  const { callId } = req.body as { callId?: string };
  if (!callId) {
    return res.status(400).json({ error: "callId is required" });
  }

  try {
    const response = await fetch(
      `https://api.openai.com/v1/realtime/calls/${callId}/hangup`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.warn("[Realtime] Hangup warning:", response.status, err);
      // Still return ok — call may already be closed locally
      return res.json({ ok: true, alreadyClosed: true });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("[Realtime] Hangup error:", error);
    res.status(500).json({ error: "Failed to hang up realtime call" });
  }
});

// GET /api/realtime/token — mint an ephemeral OpenAI Realtime API key
// ?mode=mock → server_vad with create_response:false (user controls turns)
// default   → server_vad with create_response:true  (AI auto-responds)
router.get("/token", async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  const isMockMode = req.query.mode === "mock";

  // Mock mode: VAD still detects speech (so we get speech events + auto-transcription)
  // but does NOT auto-respond or allow interruptions — "Done Speaking" button controls turns.
  // High threshold (0.85) rejects background noise — only clear speech triggers detection.
  const turnDetection = isMockMode
    ? {
        type: "server_vad",
        threshold: 0.85,
        create_response: false,
        interrupt_response: false,
        silence_duration_ms: 2500,
        prefix_padding_ms: 500,
      }
    : {
        type: "server_vad",
        threshold: 0.6,
        silence_duration_ms: 800,
        create_response: true,
        interrupt_response: true,
      };

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: "gpt-realtime-mini",
            audio: {
              input: {
                transcription: { model: "gpt-4o-transcribe" },
                turn_detection: turnDetection,
              },
              output: { voice: "alloy" },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[Realtime] Token error:", response.status, err);
      return res.status(response.status).json({ error: "Failed to generate realtime token" });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("[Realtime] Token generation error:", error);
    res.status(500).json({ error: "Failed to generate realtime token" });
  }
});

export default router;
