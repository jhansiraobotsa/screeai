import { Router } from "express";
import { supabase } from "../supabase.js";
import { getOrSet, invalidatePattern, TTL } from "../redis.js";

const router = Router();

// ─── Candidates ───────────────────────────────────────────────────────────────

// GET /api/data/candidates?org_id=xxx
router.get("/candidates", async (req, res) => {
  const { org_id } = req.query as { org_id: string };
  if (!org_id) return res.status(400).json({ error: "org_id required" });

  const data = await getOrSet(`org:${org_id}:candidates`, TTL.CANDIDATES, async () => {
    const { data: rows } = await supabase
      .from("candidates")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

  res.json(data);
});

// POST /api/data/candidates/invalidate
router.post("/candidates/invalidate", async (req, res) => {
  const { org_id } = req.body;
  if (org_id) await invalidatePattern(`org:${org_id}:candidates`);
  res.json({ ok: true });
});

// ─── Question Packs ───────────────────────────────────────────────────────────

// GET /api/data/question-packs?org_id=xxx
router.get("/question-packs", async (req, res) => {
  const { org_id } = req.query as { org_id: string };
  if (!org_id) return res.status(400).json({ error: "org_id required" });

  const data = await getOrSet(`org:${org_id}:question_packs`, TTL.QUESTION_PACKS, async () => {
    const { data: rows } = await supabase
      .from("question_packs")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

  res.json(data);
});

// POST /api/data/question-packs/invalidate
router.post("/question-packs/invalidate", async (req, res) => {
  const { org_id } = req.body;
  if (org_id) await invalidatePattern(`org:${org_id}:question_packs`);
  res.json({ ok: true });
});

// ─── Interviews ───────────────────────────────────────────────────────────────

// GET /api/data/interviews?org_id=xxx
router.get("/interviews", async (req, res) => {
  const { org_id } = req.query as { org_id: string };
  if (!org_id) return res.status(400).json({ error: "org_id required" });

  const data = await getOrSet(`org:${org_id}:interviews`, TTL.INTERVIEWS, async () => {
    const { data: rows } = await supabase
      .from("interviews")
      .select("*, candidates(full_name, email), question_packs(title)")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

  res.json(data);
});

// POST /api/data/interviews/invalidate
router.post("/interviews/invalidate", async (req, res) => {
  const { org_id } = req.body;
  if (org_id) await invalidatePattern(`org:${org_id}:interviews`);
  res.json({ ok: true });
});

export default router;
