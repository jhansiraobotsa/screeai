import { Router } from "express";
import { supabase } from "../supabase.js";
import { redis, getOrSet, invalidate, invalidatePattern, TTL } from "../redis.js";

const router = Router();

// ─── Interview State (Redis hash — ultra-fast during live sessions) ───────────

// GET /api/interview/:id/state
router.get("/:id/state", async (req, res) => {
  const { id } = req.params;
  const state = await redis.hgetall(`interview:${id}:state`);
  if (Object.keys(state).length === 0) return res.json(null);

  // Parse JSON fields
  const parsed = {
    ...state,
    currentQuestionIndex: parseInt(state.currentQuestionIndex ?? "0"),
    stage: state.stage ?? "pre_interview",
    timer: parseInt(state.timer ?? "0"),
  };
  res.json(parsed);
});

// POST /api/interview/:id/state — set/update state fields
router.post("/:id/state", async (req, res) => {
  const { id } = req.params;
  const updates = req.body as Record<string, string | number>;

  const key = `interview:${id}:state`;
  const stringified: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    stringified[k] = String(v);
  }

  await redis.hset(key, stringified);
  await redis.expire(key, TTL.INTERVIEW_STATE);
  res.json({ ok: true });
});

// DELETE /api/interview/:id/state — clear after interview ends
router.delete("/:id/state", async (req, res) => {
  await invalidate(`interview:${req.params.id}:state`);
  res.json({ ok: true });
});

// ─── Transcript Buffer (Redis list → batch flush to Supabase) ─────────────────

// POST /api/interview/:id/transcript/buffer — push to Redis list
router.post("/:id/transcript/buffer", async (req, res) => {
  const { id } = req.params;
  const entry = req.body; // { speaker, text, is_final, sequence }

  const key = `interview:${id}:transcript_buffer`;
  await redis.rpush(key, JSON.stringify(entry));
  await redis.expire(key, TTL.INTERVIEW_STATE);

  // Auto-flush when buffer hits 10 entries
  const bufferLen = await redis.llen(key);
  if (bufferLen >= 10) {
    await flushTranscriptBuffer(id);
  }

  res.json({ ok: true, buffered: bufferLen });
});

// POST /api/interview/:id/transcript/flush — force flush buffer to Supabase
router.post("/:id/transcript/flush", async (req, res) => {
  const flushed = await flushTranscriptBuffer(req.params.id);
  res.json({ ok: true, flushed });
});

async function flushTranscriptBuffer(interviewId: string): Promise<number> {
  const key = `interview:${interviewId}:transcript_buffer`;
  const items = await redis.lrange(key, 0, -1);
  if (items.length === 0) return 0;

  const rows = items.map((item) => {
    const parsed = JSON.parse(item);
    return { interview_id: interviewId, ...parsed };
  });

  await supabase.from("transcript_events").insert(rows);
  await redis.del(key);
  return rows.length;
}

// ─── Cached Interview Data ────────────────────────────────────────────────────

// GET /api/interview/:id — cached interview with candidate + question pack
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const data = await getOrSet(`interview:${id}:data`, TTL.INTERVIEWS, async () => {
    const { data: interview } = await supabase
      .from("interviews")
      .select("*, candidates(*), question_packs(title, questions)")
      .eq("id", id)
      .single();
    return interview;
  });
  res.json(data);
});

// POST /api/interview/:id/invalidate — bust cache on status change
router.post("/:id/invalidate", async (req, res) => {
  await invalidate(`interview:${req.params.id}:data`);
  res.json({ ok: true });
});

export default router;
