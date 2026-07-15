#!/bin/bash
# Deploy the interview-ai edge function to Supabase
# Usage: SUPABASE_ACCESS_TOKEN=your_token ANTHROPIC_KEY=your_key bash deploy-edge-fn.sh

PROJECT_REF="mduazwklklfeghguyqnw"
ANTHROPIC_KEY="${ANTHROPIC_KEY:-$VITE_ANTHROPIC_API_KEY}"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is not set."
  echo "Get your token from: https://supabase.com/dashboard/account/tokens"
  echo "Then run: SUPABASE_ACCESS_TOKEN=your_token ANTHROPIC_KEY=your_key bash deploy-edge-fn.sh"
  exit 1
fi

if [ -z "$ANTHROPIC_KEY" ]; then
  echo "Error: ANTHROPIC_KEY is not set (or VITE_ANTHROPIC_API_KEY in your env)."
  exit 1
fi

echo "Setting ANTHROPIC_API_KEY secret..."
npx supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_KEY" --project-ref "$PROJECT_REF"

echo "Deploying interview-ai edge function..."
npx supabase functions deploy interview-ai --project-ref "$PROJECT_REF" --no-verify-jwt

echo "Done! Claude is now powering the AI interviewer."
