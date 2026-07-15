/**
 * Cache client — talks to the local Redis cache server at /api.
 * Falls back to direct Supabase if the cache server is unreachable.
 */

const BASE = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getCachedProfile(token: string) {
  return apiFetch("/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function invalidateProfile(userId: string) {
  return apiFetch("/profile/invalidate", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

// ─── Interview State ──────────────────────────────────────────────────────────

export async function getInterviewState(interviewId: string) {
  return apiFetch<Record<string, string | number>>(`/interview/${interviewId}/state`);
}

export async function setInterviewState(
  interviewId: string,
  state: Record<string, string | number>
) {
  return apiFetch(`/interview/${interviewId}/state`, {
    method: "POST",
    body: JSON.stringify(state),
  });
}

export async function clearInterviewState(interviewId: string) {
  return apiFetch(`/interview/${interviewId}/state`, { method: "DELETE" });
}

// ─── Transcript Buffer ────────────────────────────────────────────────────────

export async function bufferTranscript(
  interviewId: string,
  entry: { speaker: string; text: string; is_final: boolean; sequence: number }
) {
  return apiFetch(`/interview/${interviewId}/transcript/buffer`, {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function flushTranscriptBuffer(interviewId: string) {
  return apiFetch(`/interview/${interviewId}/transcript/flush`, { method: "POST" });
}

// ─── Cached Data ──────────────────────────────────────────────────────────────

export async function getCachedCandidates(orgId: string) {
  return apiFetch<unknown[]>(`/data/candidates?org_id=${orgId}`);
}

export async function getCachedInterviews(orgId: string) {
  return apiFetch<unknown[]>(`/data/interviews?org_id=${orgId}`);
}

export async function getCachedQuestionPacks(orgId: string) {
  return apiFetch<unknown[]>(`/data/question-packs?org_id=${orgId}`);
}

export async function invalidateCandidates(orgId: string) {
  return apiFetch("/data/candidates/invalidate", {
    method: "POST",
    body: JSON.stringify({ org_id: orgId }),
  });
}

export async function invalidateInterviews(orgId: string) {
  return apiFetch("/data/interviews/invalidate", {
    method: "POST",
    body: JSON.stringify({ org_id: orgId }),
  });
}

export async function invalidateQuestionPacks(orgId: string) {
  return apiFetch("/data/question-packs/invalidate", {
    method: "POST",
    body: JSON.stringify({ org_id: orgId }),
  });
}
