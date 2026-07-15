# Screen.ai — End-to-End Application Check

**Date:** March 11, 2026  
**Status:** ✅ Build passes | ⚠️ 13 lint errors (non-blocking)

---

## 1. Build & Startup

| Check | Status |
|-------|--------|
| Vite build | ✅ Success (5.31s) |
| Dev server (Vite 8080) | ✅ Starts |
| Cache server (3001) | ✅ Starts, Redis connected |
| API proxy `/api` → `localhost:3001` | ✅ Configured |

---

## 2. Routes & Entry Points

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Redirect → `/dashboard` | Root |
| `/auth` | Auth | Login / signup |
| `/reset-password` | ResetPassword | Password reset |
| `/candidate/:invite` | CandidatePortal | Candidate invite flow |
| `/interview-room/:id` | InterviewRoom | Live interview |
| `/dashboard` | Dashboard | (Protected) |
| `/interviews` | Interviews | (Protected) |
| `/candidates` | Candidates | (Protected) |
| `/question-packs` | QuestionPacks | (Protected) |
| `/settings` | SettingsPage | (Protected) |
| `/analytics` | Analytics | (Protected) |

---

## 3. Interview Room Flow (E2E)

### 3.1 Pre-Interview

1. Load `/interview-room/:id` → fetches interview, candidate, question pack
2. `useVideoStream` → requests camera + mic (separate streams)
3. **Stage:** `pre_interview`
4. User clicks **Start Interview** → `startInterview()`

### 3.2 Greeting

1. `callAI("greet")` with `stream: true`
2. Edge function `interview-ai` → Anthropic streaming
3. Client parses SSE: `content_block_delta` + `text_delta`
4. `aiSpeakingText` updates word-by-word
5. TTS plays sentence-by-sentence (on `.` `!` `?`)
6. `onTTSEnd` → **Stage:** `listening`

### 3.3 Asking & Listening Loop

1. If questions exist → `callAI("ask_question")` (streaming)
2. AI text streams, TTS speaks
3. `onTTSEnd` → **Stage:** `listening`
4. **useDeepgram** starts: KeepAlive every 3s, interim + final callbacks
5. User speaks → `liveCaptions` (interim) + `spokenText` (final)
6. **Submit Answer** appears when `spokenText || liveCaptions`
7. `submitSpoken()` → `handleCandidateAnswer(text)`

### 3.4 Processing Answer

1. `stopMic()`, **Stage:** `processing`
2. `callAI("follow_up")` (non-streaming, JSON)
3. Parse `should_follow_up`, `response`
4. If follow-up → TTS speaks response, then **Stage:** `asking`
5. If next question → `callAI("ask_question")` again
6. If all done → `endInterview()`

### 3.5 Wrap Up & Evaluation

1. `callAI("wrap_up")` (streaming)
2. `callAI("evaluate")` (non-streaming, Sonnet)
3. Parse JSON scores, insert into `scores`
4. **Stage:** `completed` → show score cards

---

## 4. Integration Points

| Component | Dependency | Notes |
|-----------|------------|-------|
| Supabase | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Auth, DB, Realtime, Edge Functions |
| Deepgram | `VITE_DEEPGRAM_API_KEY` | Live transcription |
| Anthropic | `VITE_ANTHROPIC_API_KEY` or Edge secret | AI responses |
| OpenAI | `VITE_OPENAI_API_KEY` | TTS (optional) |
| Redis + Express | `localhost:3001` | Cache for profile, candidates, interviews |

---

## 5. Edge Function Compatibility

| Client Expectation | Edge Function | Match |
|--------------------|---------------|-------|
| `stream: true` for greet/ask_question/wrap_up | `shouldStream` → `callClaudeStream` | ✅ |
| SSE `content_block_delta` + `text_delta` | Anthropic native format, piped to client | ✅ |
| Non-streaming for follow_up, evaluate | `callClaude` → JSON response | ✅ |
| Questions from pack (no hardcoded fallback) | Uses `question?.text` or AI-generated | ✅ |

---

## 6. Known Lint Issues (Non-Blocking)

- `@typescript-eslint/no-explicit-any` in several files
- `react-hooks/exhaustive-deps` warnings (useAuth, AudioWaveform)
- `prefer-const` in AddCandidateDialog
- `no-require-imports` in tailwind.config

---

## 7. Recommendations

1. **Test manually:** Run through a full interview from candidate invite → completion
2. **Redeploy edge function** after any `interview-ai` changes
3. **Mic permissions:** Ensure camera/mic are allowed; if not, permission-denied UI shows
4. **Transcript panel:** Opens by default (`showTranscript: true`)
