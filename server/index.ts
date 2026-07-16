import "dotenv/config";
import express from "express";
import cors from "cors";
import { resolve } from "path";
import { existsSync } from "fs";
import { redis } from "./redis.js";
import profileRouter from "./routes/profile.js";
import interviewRouter from "./routes/interview.js";
import dataRouter from "./routes/data.js";
import realtimeRouter from "./routes/realtime.js";
import emailRouter from "./routes/email.js";
import questionsRouter from "./routes/questions.js";
import mockSessionRouter from "./routes/mock-session.js";
import uploadsRouter from "./routes/uploads.js";
import jobsRouter from "./routes/jobs.js";
import notifyRouter from "./routes/notify.js";
import costsRouter from "./routes/costs.js";
import "./queue.js"; // starts the resume-scoring worker

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === "production";

// Allow localhost and any private-LAN origin (10.x, 172.16-31.x, 192.168.x)
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/(?:10|127)\.\d+\.\d+\.\d+:\d+$/, /^http:\/\/172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/] }));
app.use(express.json());

// Health check + Redis stats
app.get("/api/health", async (_req, res) => {
  const info = await redis.info("stats").catch(() => "unavailable");
  const keyCount = await redis.dbsize().catch(() => 0);
  res.json({
    status: "ok",
    redis: { connected: redis.status === "ready", keys: keyCount },
    uptime: process.uptime(),
  });
});

// Flush all Redis cache
app.post("/api/cache/flush", async (_req, res) => {
  await redis.flushdb();
  res.json({ ok: true, message: "Cache flushed" });
});

app.use("/api/profile", profileRouter);
app.use("/api/interview", interviewRouter);
app.use("/api/data", dataRouter);
app.use("/api/realtime", realtimeRouter);
app.use("/api/email", emailRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/mock-session", mockSessionRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/notify", notifyRouter);
app.use("/api/costs", costsRouter);

// In production, serve the built frontend (dist/) and SPA-fallback all
// non-API routes to index.html. In dev, Vite serves the frontend separately.
if (isProd) {
  const distDir = resolve(process.cwd(), "dist");
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(resolve(distDir, "index.html"));
    });
  } else {
    console.warn("[Server] dist/ not found — did you run `npm run build`?");
  }
}

// Connect Redis then start
redis.connect().then(async () => {
  const keyCount = await redis.dbsize();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Cache Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Cache Server] Redis ready — ${keyCount} keys in db`);
  });
}).catch((err) => {
  console.error("[Cache Server] Redis connection failed:", err.message);
  process.exit(1);
});
