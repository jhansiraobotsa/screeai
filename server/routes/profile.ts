import { Router } from "express";
import { supabase } from "../supabase.js";
import { redis, getOrSet, invalidate, TTL } from "../redis.js";

const router = Router();

// GET /api/profile — returns profile + org for the authenticated user
router.get("/", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");

  try {
    // Verify token and get user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

    const cacheKey = `profile:${user.id}`;
    const profile = await getOrSet(cacheKey, TTL.PROFILE, async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, organizations(*)")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    });

    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profile/invalidate — bust cache after profile update
router.post("/invalidate", async (req, res) => {
  const { userId } = req.body;
  if (userId) await invalidate(`profile:${userId}`);
  res.json({ ok: true });
});

export default router;
