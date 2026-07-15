# Screen.ai

AI-powered hiring and interview platform. Post jobs, collect applications, let AI
score resumes against each role, invite candidates, and run adaptive voice
interviews conducted by an AI interviewer — with automatic evaluation.

## Features

- **Jobs** — create/publish postings with a rich-text editor (Tiptap) and expiry dates.
- **Applications** — candidates apply with a resume (PDF/DOCX) + details after logging in.
- **AI resume scoring** — each application is scored 0–100 against the job by Claude, with reasoning (runs as a background job).
- **Candidate tagging** — tag people by role so they auto-surface for future matching jobs.
- **Interview invites** — select applicants and email them an interview link.
- **Adaptive AI interview** — a voice interviewer ("Alex") asks exactly 10 questions generated from the candidate's resume, with inline follow-ups, then auto-evaluates the transcript.
- **Role-based access** — admins manage everything; regular users see only their own interviews.
- **Background job queue** — resume scoring and question generation run on BullMQ + Redis with retries.

## Tech stack

- **Frontend:** Vite + React + TypeScript, shadcn/ui, Tailwind CSS, TanStack Query
- **Backend:** Express (Node), BullMQ job queue
- **Data/Auth:** Supabase (Postgres + Auth + Storage), Row-Level Security
- **Cache/Queue:** Redis (ioredis)
- **AI:** Anthropic Claude (interview + scoring + question generation), OpenAI Realtime (voice), Deepgram (transcription)
- **Email:** Gmail SMTP (nodemailer) / Resend
- **Resume parsing:** pdf-parse, mammoth

## Prerequisites

- Node.js 18+ and npm
- A running Redis instance (`localhost:6379` by default)
- A Supabase project (run the SQL in `supabase/migrations/`)
- API keys: Anthropic, OpenAI, Deepgram; Gmail app password for email

## Environment

Create a `.env` in the project root (never commit it — it is gitignored):

```
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
VITE_ANTHROPIC_API_KEY="<anthropic-key>"
VITE_OPENAI_API_KEY="<openai-key>"
VITE_DEEPGRAM_API_KEY="<deepgram-key>"
GMAIL_USER="you@gmail.com"
GMAIL_APP_PASSWORD="<gmail-app-password>"
APP_URL="https://your-domain.com"     # used to build invite/email links
PORT="8003"                            # server port (production)
# REDIS_URL="redis://..."              # optional; defaults to localhost:6379
```

> Note: `VITE_`-prefixed keys are embedded in the client bundle and visible to
> anyone using the app. Treat the Anthropic/OpenAI/Deepgram keys accordingly and
> plan to move those calls fully server-side for a hardened deployment.

## Development

Runs the Vite dev server (frontend) and the Express API together:

```sh
npm install
npm run start        # vite (8080) + tsx watch server (3001), proxied
```

- Frontend: http://localhost:8080
- API: http://localhost:3001 (proxied under `/api` by Vite)

## Production

In production the Express server serves the built frontend **and** the API on a
single port (`PORT`, default 8003):

```sh
npm install
npm run build        # builds the frontend into dist/
npm run start:prod   # serves dist/ + /api on $PORT (cross-platform)
```

Put a reverse proxy (with HTTPS) in front, forwarding your domain → `localhost:$PORT`.
A single forwarding rule covers both the app and `/api`.

**Microphone note:** browsers only allow mic access over HTTPS (or localhost), so
the interview voice feature requires the app to be served over HTTPS in production.

**WebSocket note:** the interview voice + transcription use WebSockets — ensure your
proxy is configured to upgrade WebSocket connections.

## Database

SQL migrations live in `supabase/migrations/`. Apply them in the Supabase SQL
editor (or via the Supabase CLI). RLS policies and helper functions (scoring,
question generation, invites) are defined there.

## Deployment

- `render.yaml` provides a Render Blueprint (web service + Redis) as one option.
- For a self-hosted VM: clone, create `.env`, `npm install && npm run build && npm run start:prod`, and front it with an HTTPS reverse proxy.