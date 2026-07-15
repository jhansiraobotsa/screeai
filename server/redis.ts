import Redis from "ioredis";

// Use REDIS_URL in production (e.g. Render/Upstash); fall back to local Redis.
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: null,
    })
  : new Redis({
      host: "127.0.0.1",
      port: 6379,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

redis.on("connect", () => console.log("[Redis] Connected"));
redis.on("error", (err) => console.error("[Redis] Error:", err.message));

// TTL constants (seconds)
export const TTL = {
  PROFILE: 300,       // 5 min — changes rarely
  CANDIDATES: 120,    // 2 min
  INTERVIEWS: 60,     // 1 min
  QUESTION_PACKS: 300,
  INTERVIEW_STATE: 7200, // 2 hrs — active interview duration
};

export async function getOrSet<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const data = await fetcher();
  if (data !== null && data !== undefined) {
    await redis.setex(key, ttl, JSON.stringify(data));
  }
  return data;
}

export async function invalidate(...keys: string[]) {
  if (keys.length > 0) await redis.del(...keys);
}

export async function invalidatePattern(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
