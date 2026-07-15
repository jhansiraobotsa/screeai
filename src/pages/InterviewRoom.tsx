import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Play, Loader2,
  CheckCircle2, Clock, MessageSquare,
  X, Send, ChevronRight, Star, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useRealtimeWebRTC } from "@/hooks/useRealtimeWebRTC";
import { useVideoStream } from "@/hooks/useVideoStream";
import { useDeepgram } from "@/hooks/useDeepgram";
import { AudioWaveform } from "@/components/interview/AudioWaveform";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question { id: string; text: string; order: number; type: string; }
interface TranscriptEntry { id: string; speaker: string; text: string; is_final: boolean; created_at: string; }
interface ScoreEntry { dimension: string; score: number; evidence: string; }

type Stage = "pre_interview" | "live" | "wrapping_up" | "evaluating" | "completed";

// ─── Flow steps shown at top ─────────────────────────────────────────────────

const FLOW_STEPS = [
  { id: "pre_interview", label: "Ready" },
  { id: "live",          label: "Interview" },
  { id: "wrapping_up",   label: "Wrap Up" },
  { id: "evaluating",    label: "Evaluating" },
  { id: "completed",     label: "Complete" },
];

const FLOW_INDEX: Record<Stage, number> = {
  pre_interview: 0, live: 1, wrapping_up: 2, evaluating: 3, completed: 4,
};

/** Detect Alex's natural closing message in normal (non-mock) mode */
function isInterviewClosingMessage(text: string): boolean {
  const lower = text.toLowerCase();
  const hasClosingSignal =
    /covered (?:all|both|every|the).{0,30}questions?/i.test(lower) ||
    /team will review/i.test(lower) ||
    /be in touch/i.test(lower) ||
    /wish you (?:all )?the best/i.test(lower) ||
    /wraps up our interview/i.test(lower) ||
    /concludes our interview/i.test(lower) ||
    /interview is complete/i.test(lower) ||
    /no more questions/i.test(lower) ||
    /appreciate your time today/i.test(lower);
  const hasThankYou = /thank you|thanks for|appreciate your time/i.test(lower);
  return hasClosingSignal && hasThankYou;
}

// ─── Score colour helpers ─────────────────────────────────────────────────────

const scoreColor  = (s: number) => s >= 8 ? "text-emerald-400"  : s >= 5 ? "text-amber-400"  : "text-red-400";
const scoreBar    = (s: number) => s >= 8 ? "bg-emerald-500"     : s >= 5 ? "bg-amber-500"    : "bg-red-500";
const scoreBg     = (s: number) => s >= 8 ? "bg-emerald-500/10 border-emerald-500/20" : s >= 5 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

// ─── Component ───────────────────────────────────────────────────────────────

export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data
  const [interview,  setInterview]  = useState<Tables<"interviews"> | null>(null);
  const [candidate,  setCandidate]  = useState<Tables<"candidates"> | null>(null);
  const [questions,  setQuestions]   = useState<Question[]>([]);
  const [transcript, setTranscript]  = useState<TranscriptEntry[]>([]);

  // State machine
  const [stage,        setStage]        = useState<Stage>("pre_interview");
  const [timer,        setTimer]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [scores,       setScores]       = useState<ScoreEntry[]>([]);
  const [evalSummary,  setEvalSummary]  = useState("");
  const [aiLiveText,   setAiLiveText]   = useState(""); // center-screen caption only
  const liveAiEntryIdRef = useRef<string | null>(null); // ID of the in-progress sidebar entry

  // User live transcription (Deepgram parallel pipeline)
  const [userLiveText,     setUserLiveText]     = useState("");
  const [userTranscribing, setUserTranscribing] = useState(false);

  // Mock mode state (10-question turn-taking)
  const [isMockMode,     setIsMockMode]     = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionPhase,  setQuestionPhase]  = useState<"ai_speaking" | "user_answering" | "processing">("ai_speaking");
  const [micLocked,      setMicLocked]      = useState(true);

  // UI toggles
  const [showTranscript, setShowTranscript] = useState(true);
  const [manualInput,    setManualInput]    = useState("");
  const [showManual,     setShowManual]     = useState(false);

  // Refs
  const stageRef       = useRef<Stage>("pre_interview");
  const transcriptRef  = useRef<TranscriptEntry[]>([]);
  const scrollRef      = useRef<HTMLDivElement>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval>>();
  const wrappingUpRef  = useRef(false);
  const completingRef  = useRef(false);
  const wrapUpTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const completeAfterWrapUpRef = useRef<(() => Promise<void>) | null>(null);
  const sequenceRef    = useRef(0);

  const isMockModeRef      = useRef(false);
  const currentQuestionRef = useRef(0);
  const questionPhaseRef   = useRef<"ai_speaking" | "user_answering" | "processing">("ai_speaking");

  useEffect(() => { stageRef.current          = stage;          }, [stage]);
  useEffect(() => { transcriptRef.current     = transcript;     }, [transcript]);
  useEffect(() => { isMockModeRef.current     = isMockMode;     }, [isMockMode]);
  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { questionPhaseRef.current  = questionPhase;  }, [questionPhase]);

  // ─── Media ──────────────────────────────────────────────────────────────────

  const {
    videoRef, micStream, permissionDenied,
    toggleMic, toggleCamera, micEnabled, cameraEnabled,
  } = useVideoStream();

  const micStreamRef = useRef(micStream);
  useEffect(() => { micStreamRef.current = micStream; }, [micStream]);

  // Mock mode: lock/unlock mic tracks based on micLocked state
  useEffect(() => {
    if (micStream && isMockMode) {
      micStream.getAudioTracks().forEach(t => { t.enabled = !micLocked; });
    }
  }, [micLocked, micStream, isMockMode]);

  // ─── Transcript helper ──────────────────────────────────────────────────────

  const addTranscriptEntry = useCallback((speaker: string, text: string) => {
    const entry: TranscriptEntry = {
      id: crypto.randomUUID(),
      speaker,
      text,
      is_final: true,
      created_at: new Date().toISOString(),
    };
    setTranscript(prev => [...prev, entry]);

    const seq = sequenceRef.current++;
    supabase.from("transcript_events").insert({
      interview_id: id!, speaker, text, is_final: true, sequence: seq,
    });
  }, [id]);

  // ─── Evaluate with Claude (post-interview) ─────────────────────────────────

  const evaluateInterview = useCallback(async () => {
    setStage("evaluating");
    try {
      const txt = transcriptRef.current
        .filter(t => t.is_final)
        .map(t => `${t.speaker}: ${t.text}`)
        .join("\n");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "evaluate",
            interviewId: id,
            candidateName: candidate?.full_name ?? "Candidate",
            resumeText: candidate?.resume_text ?? "",
            questions,
            transcriptSoFar: txt,
            currentQuestionIndex: 0,
            anthropicApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
            stream: false,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const evalResult: string = data.content ?? "";
        if (evalResult) {
          const m = evalResult.match(/\{[\s\S]*\}/);
          const parsed = m ? JSON.parse(m[0]) : null;
          if (parsed?.scores) {
            for (const s of parsed.scores) {
              await supabase.from("scores").insert({
                interview_id: id!,
                dimension: s.dimension,
                score: s.score,
                evidence: s.evidence,
              });
            }
            setScores(parsed.scores);
            if (parsed.summary) setEvalSummary(parsed.summary);
          }
        }
      }
    } catch (e) {
      console.error("Evaluation error:", e);
      toast.error("Evaluation failed");
    }
    setStage("completed");
  }, [id, candidate, questions]);

  // ─── Realtime WebRTC ────────────────────────────────────────────────────────

  const {
    connect, disconnect, updateSession, sendEvent,
    sendTextMessage, triggerResponse, commitAudioBuffer, clearAudioBuffer,
    isConnected, isConnecting, aiSpeaking, userSpeaking,
  } = useRealtimeWebRTC({
    // Mock mode token disables auto-response; normal token enables it
    tokenUrl: isMockMode ? "/api/realtime/token?mode=mock" : "/api/realtime/token",
    onUserTranscript: (text) => {
      if (wrappingUpRef.current || stageRef.current === "wrapping_up") return;

      const phase = questionPhaseRef.current;
      // In mock mode, ignore transcripts that arrive during AI's turn (noise artifacts)
      if (isMockModeRef.current && phase !== "user_answering") {
        console.log(`[Realtime] User transcript dropped (phase=${phase}):`, text.substring(0, 40));
        return;
      }
      console.log("[Realtime] User transcript accepted:", text.substring(0, 60));
      // OpenAI final transcript arrived — clear Deepgram preview and add to transcript
      setUserLiveText("");
      setUserTranscribing(false);
      addTranscriptEntry("Candidate", text);
    },
    onUserSpeakingChange: (speaking) => {
      if (wrappingUpRef.current || stageRef.current === "wrapping_up") return;

      // In mock mode, completely ignore speech events unless it's the user's turn.
      // This prevents background noise from showing "You are speaking" during AI speech.
      if (isMockModeRef.current && questionPhaseRef.current !== "user_answering") {
        return;
      }

      if (!speaking) {
        setUserTranscribing(true);
      } else {
        setUserTranscribing(false);
      }
    },
    onAITranscriptDelta: (_delta, accumulated) => {
      setAiLiveText(accumulated);
      // Create the sidebar entry on first delta, then grow it in-place
      if (!liveAiEntryIdRef.current) {
        const entryId = crypto.randomUUID();
        liveAiEntryIdRef.current = entryId;
        setTranscript(prev => [...prev, {
          id: entryId, speaker: "AI", text: accumulated,
          is_final: false, created_at: new Date().toISOString(),
        }]);
      } else {
        const entryId = liveAiEntryIdRef.current;
        setTranscript(prev => prev.map(e =>
          e.id === entryId ? { ...e, text: accumulated } : e
        ));
      }
    },
    onAITranscriptDone: (text) => {
      // Finalize the in-place entry
      const entryId = liveAiEntryIdRef.current;
      if (entryId) {
        setTranscript(prev => prev.map(e =>
          e.id === entryId ? { ...e, text, is_final: true } : e
        ));
        const seq = sequenceRef.current++;
        supabase.from("transcript_events").insert({
          interview_id: id!, speaker: "AI", text, is_final: true, sequence: seq,
        });
        liveAiEntryIdRef.current = null;
      }
      setAiLiveText("");

      // Normal mode: auto-end when Alex delivers the closing message.
      // NOTE: this fires when the closing TRANSCRIPT is finalized, but Alex's
      // audio is usually still playing. We must NOT cancel/clear the current
      // response here — that would cut the goodbye off mid-sentence. We only
      // mute the mic so the candidate can't trigger a new reply, then let the
      // audio play out. completeAfterWrapUp runs from onAISpeakingChange(false)
      // once the goodbye audio actually finishes.
      if (
        !isMockModeRef.current &&
        stageRef.current === "live" &&
        !wrappingUpRef.current &&
        isInterviewClosingMessage(text)
      ) {
        console.log("[InterviewRoom] Closing message detected → letting Alex finish, then wrap-up");
        wrappingUpRef.current = true;
        setStage("wrapping_up");
        stopDeepgram();
        setUserLiveText("");
        setUserTranscribing(false);
        // Mute mic so Alex doesn't respond to the candidate after closing.
        micStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
    },
    onAISpeakingChange: (speaking) => {
      if (!speaking) {
        setAiLiveText("");
        // Fires from output_audio_buffer.audio_stopped — audio truly finished playing
        // Mock mode: unlock mic now that AI audio is done
        if (isMockModeRef.current && stageRef.current === "live") {
          clearAudioBuffer();
          // Set ref SYNCHRONOUSLY so Deepgram/OpenAI callbacks see correct phase immediately
          questionPhaseRef.current = "user_answering";
          setMicLocked(false);
          setQuestionPhase("user_answering");
          console.log("[MockMode] AI done → phase=user_answering, mic unlocked");
        }

        // After wrap-up goodbye finishes, disconnect and go to review
        if (wrappingUpRef.current && !completingRef.current) {
          if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
          wrapUpTimerRef.current = setTimeout(() => {
            wrapUpTimerRef.current = undefined;
            void completeAfterWrapUpRef.current?.();
          }, 1500);
        }
      }
    },
    onEvent: (event) => {
      // Fallback: if audio_stopped was missed, still complete after wrap-up response
      if (event.type === "response.done" && wrappingUpRef.current && !completingRef.current) {
        if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
        wrapUpTimerRef.current = setTimeout(() => {
          wrapUpTimerRef.current = undefined;
          void completeAfterWrapUpRef.current?.();
        }, 2500);
      }
    },
    onError: (err) => {
      // Suppress known harmless errors
      if (err.includes("no active response")) {
        console.warn("[Realtime] Suppressed:", err);
        return;
      }
      toast.error(err);
    },
  });

  // ─── Deepgram parallel transcription (live user text) ─────────────────────

  const { start: startDeepgram, stop: stopDeepgram } = useDeepgram({
    apiKey: import.meta.env.VITE_DEEPGRAM_API_KEY,
    onInterim: (text) => {
      const phase = questionPhaseRef.current;
      // In mock mode, ignore Deepgram output unless it's user's turn
      if (isMockModeRef.current && phase !== "user_answering") {
        console.log(`[Deepgram] Interim dropped (phase=${phase}):`, text.substring(0, 40));
        return;
      }
      setUserLiveText(text);
    },
    onFinal: (text) => {
      const phase = questionPhaseRef.current;
      if (isMockModeRef.current && phase !== "user_answering") {
        console.log(`[Deepgram] Final dropped (phase=${phase}):`, text.substring(0, 40));
        return;
      }
      console.log("[Deepgram] Final accepted:", text.substring(0, 60));
      setUserLiveText(text);
    },
    onError: (err) => console.warn("[Deepgram]", err),
  });

  const completeAfterWrapUp = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    wrappingUpRef.current = false;

    stopDeepgram();
    setUserLiveText("");
    setUserTranscribing(false);
    await disconnect();

    if (id) {
      const { error } = await supabase.from("interviews").update({
        status: "completed",
        ended_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) {
        console.error("Failed to mark interview completed:", error);
        toast.error("Could not save interview completion. Please contact your recruiter.");
      }
      clearInterval(timerRef.current);
      setInterview(p => p ? { ...p, status: "completed" } : null);
    }

    evaluateInterview();
  }, [id, stopDeepgram, disconnect, evaluateInterview]);

  useEffect(() => {
    completeAfterWrapUpRef.current = completeAfterWrapUp;
  }, [completeAfterWrapUp]);

  // ─── Supabase data fetch ───────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: iv } = await supabase.from("interviews").select("*").eq("id", id).single();
      if (!iv) { toast.error("Interview not found"); navigate("/interviews"); return; }
      setInterview(iv);

      const { data: cd } = await supabase.from("candidates").select("*").eq("id", iv.candidate_id).single();
      setCandidate(cd);

      // Check if this is a mock session interview
      if (iv.mock_session_id) {
        setIsMockMode(true);
        isMockModeRef.current = true;
        const { data: ms } = await supabase
          .from("mock_sessions")
          .select("questions, resume_text, job_description")
          .eq("id", iv.mock_session_id)
          .single();
        if (ms) {
          setQuestions((ms.questions as unknown as Question[]) ?? []);
        }
      } else if (iv.question_pack_id) {
        const { data: pk } = await supabase.from("question_packs").select("questions").eq("id", iv.question_pack_id).single();
        if (pk) setQuestions((pk.questions as unknown as Question[]) ?? []);
      } else if (iv.questions) {
        // Invited-applicant flow: resume-based questions stored on the interview.
        setQuestions((iv.questions as unknown as Question[]) ?? []);
      }

      const { data: tr } = await supabase.from("transcript_events").select("*").eq("interview_id", id).order("sequence", { ascending: true });
      const existing = (tr as TranscriptEntry[]) ?? [];
      setTranscript(existing);
      sequenceRef.current = existing.length;

      if (iv.status === "completed") {
        const { data: sc } = await supabase.from("scores").select("*").eq("interview_id", id);
        if (sc?.length) setScores(sc as ScoreEntry[]);
        setStage("completed");
      }

      setLoading(false);
    })();
  }, [id, navigate]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, aiLiveText, userLiveText]);

  // Timer
  useEffect(() => {
    if (stage !== "pre_interview" && stage !== "completed") {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [stage]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ─── Build interview instructions for the Realtime model ───────────────────

  const buildInstructions = useCallback(() => {
    const name = candidate?.full_name ?? "the candidate";
    const questionList = questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
    // Short excerpt for the mock-mode reference block.
    const resume = candidate?.resume_text?.substring(0, 800) ?? "";
    // Full resume (bounded) for the real adaptive interview.
    const fullResume = candidate?.resume_text?.substring(0, 6000) ?? "";

    if (isMockMode) {
      return `You are Alex, a professional AI interviewer participating in a live voice interview with ${name}. This is a real-time audio conversation — NOT a text chat. You must behave exactly like a real human interviewer on a Teams/Meet/Zoom call.

COMMAND SYSTEM:
- You receive commands via text messages. ONLY respond when you receive a command.
- "ASK_QUESTION:" followed by text → Ask ONLY the given question naturally. One question, nothing else.
- "WRAP_UP" → Thank the candidate warmly (2-3 sentences). Acknowledge you've covered all your questions, thank them for their time, and let them know the team will review their responses. Wish them well and say goodbye.
- NEVER ask questions on your own. NEVER generate questions. Wait for commands.

VOICE BEHAVIOR:
- Speak in a natural, calm, confident, and friendly tone — like a real interviewer.
- Moderate pace. Not too fast, not too slow.
- Concise and conversational. Every word should sound like something a real person would say in a live interview.
- No robotic, stiff, or overly formal phrasing.
- Sound like a real person on a video call — warm, professional, human.
- NO bullet points, NO lists, NO markdown formatting. Flowing natural sentences only.

TURN TAKING:
- Ask one question at a time. Stop immediately after asking.
- NEVER continue speaking after posing a question. The candidate must have full space to respond.
- NEVER ask multiple questions in one turn.
- After asking a question: STOP. Silence. Wait.

LISTENING BEHAVIOR:
- Remain completely silent while the candidate is speaking.
- Do NOT interrupt. Do NOT give filler words. Do NOT acknowledge mid-speech.
- No "mm-hmm", "right", "okay", "I see" while the candidate is talking.
- Let the candidate finish completely before you say anything.

RESPONSE TRANSITIONS:
- After a candidate finishes answering, use a short natural transition before the next question.
- Examples: "Thank you.", "That's helpful.", "Appreciate that.", "Good to know.", "Thanks for sharing that."
- Keep transitions to ONE short sentence, then proceed with the next question command.
- Do NOT give feedback, evaluate, or comment on the quality of answers.

INTERVIEW PRESENCE:
- Project quiet confidence throughout the interview.
- Maintain a steady, reassuring energy — like a senior interviewer who has done hundreds of interviews.
- Be polite but not overly enthusiastic. Professional warmth, not cheerleading.
- Sound interested in what the candidate says, without overreacting.

SPEECH STYLE:
- Use contractions naturally ("I'd", "we're", "that's").
- Vary sentence length — mix short and medium sentences.
- Avoid long monologues. Keep each response under 3 sentences.
- No jargon dumps. No corporate buzzwords unless natural in context.
- Sound like you're having a real conversation, not reading a script.

LATENCY MANAGEMENT:
- If the candidate pauses briefly, remain silent. Do NOT assume they have finished.
- Allow natural pauses — real conversations have them.
- Only respond after receiving a command indicating the candidate is done.

CONTEXT AWARENESS:
- The questions are provided externally via commands. Do NOT generate your own questions.
- Do NOT decide which question comes next, score answers, or evaluate performance.
- Your job: deliver questions naturally, listen attentively, create a realistic interview atmosphere, and maintain smooth voice interaction.
- Do NOT announce question numbers or say "next question" or "moving on".

QUESTIONS (for reference only — wait for ASK_QUESTION command):
${questionList}

${resume ? `CANDIDATE RESUME (excerpt):\n${resume}` : ""}`.trim();
    }

    const total = questions.length;

    return `You are Alex, a professional AI interviewer conducting a job interview with ${name}. This is a resume-driven, adaptive interview.

INTERVIEW STRUCTURE:
1. Greet ${name} warmly and introduce yourself as Alex, the AI interviewer.
2. Let them know the interview will have ${total} questions and to take their time.
${fullResume ? "3. You have carefully reviewed their resume (below). Reference specific things from it as you go." : ""}

THE ${total} QUESTIONS (ask each as its own distinct topic, in this order):
${questionList || "Ask relevant interview questions based on the candidate's background."}

HARD RULES ON QUESTION COUNT (critical):
- There are EXACTLY ${total} main questions. You must cover all ${total} distinct topics above — no fewer.
- You may ask AT MOST ONE brief follow-up on a given answer IF the candidate's response is vague, incomplete, or opens an interesting resume-related thread. A follow-up drills into THEIR answer — it is not a new topic.
- NEVER introduce new main topics beyond the ${total} listed. NEVER exceed the ${total} planned questions with additional standalone questions.
- Adapt follow-ups to the candidate's behaviour and resume: if they answer thoroughly, move on with no follow-up; if they're brief or unclear, probe once.
- Track your progress. Once all ${total} topics are covered, STOP asking and wrap up.

STYLE:
- Ask each question naturally and conversationally — do not read them word-for-word.
- Ground questions and follow-ups in their actual resume (projects, roles, technologies they listed).
- Keep your turns to 2-4 sentences. Be concise, professional, friendly, encouraging.
- Do NOT use markdown, bullet points, or lists. Natural flowing sentences only.
- Do NOT announce question numbers or say "next question".

CLOSING:
- After all ${total} topics are covered, deliver a warm closing (2-3 sentences). You MUST say "We've covered all the questions", thank ${name} sincerely for their time, and let them know the team will review and be in touch. This is your FINAL message — do NOT ask more questions, do NOT respond if the candidate speaks after, do NOT invite further conversation, do NOT say you are waiting for instructions.

${fullResume ? `CANDIDATE RESUME:\n${fullResume}` : ""}`.trim();
  }, [candidate, questions, isMockMode]);

  // ─── Start interview ───────────────────────────────────────────────────────

  const startInterview = async () => {
    if (!id) return;
    console.log("[InterviewRoom] startInterview called");

    // Guard: never start an interview with no questions (e.g. question
    // generation hasn't finished or failed) — it would immediately wrap up.
    if (questions.length === 0) {
      toast.error("Your interview questions are still being prepared. Please wait a moment and refresh.");
      return;
    }

    const mic = micStream;
    if (!mic) {
      toast.error("Microphone not ready yet. Please wait a moment and try again.");
      return;
    }

    try {
      completingRef.current = false;
      wrappingUpRef.current = false;
      await disconnect(); // Clean up stale connection before starting

      await supabase
        .from("interviews")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", id);
      setInterview(p => p ? { ...p, status: "live" } : null);
      setStage("live");

      console.log("[InterviewRoom] Connecting WebRTC...", { isMockMode });
      // tokenUrl is set in hook options based on isMockMode — mock gets create_response:false
      await connect(mic);

      console.log("[InterviewRoom] Connected! Sending session config...");
      // GA API: session.update requires type: "realtime"
      // Token already configured turn_detection + transcription at creation time
      updateSession({
        type: "realtime",
        instructions: buildInstructions(),
      });

      if (isMockMode) {
        // Lock mic until AI finishes greeting
        questionPhaseRef.current = "ai_speaking"; // Set ref synchronously
        setMicLocked(true);
        setQuestionPhase("ai_speaking");
        setCurrentQuestion(0);
        console.log("[MockMode] Interview started — phase=ai_speaking, mic locked");
        // In mock mode (create_response:false), we must manually trigger responses
        // Start with greeting, then immediately ask Q1
        sendTextMessage(
          `Greet ${candidate?.full_name ?? "the candidate"} briefly (1 sentence). Then ask question 1: "${questions[0]?.text ?? "Tell me about yourself."}"`
        );
      } else {
        triggerResponse(); // Trigger AI greeting
      }

      // Start Deepgram for live user transcription display (parallel to OpenAI)
      startDeepgram(mic);
      console.log("[InterviewRoom] Interview started successfully");
    } catch (e) {
      console.error("[InterviewRoom] Start failed:", e);
      toast.error(e instanceof Error ? e.message : "Failed to start interview");
      setStage("pre_interview");
    }
  };

  // ─── End interview ─────────────────────────────────────────────────────────

  const endInterview = useCallback(async () => {
    if (!id) return;

    // Stop Deepgram live transcription
    stopDeepgram();
    setUserLiveText("");
    setUserTranscribing(false);

    // If still connected, ask AI to wrap up
    if (isConnected) {
      wrappingUpRef.current = true;
      setStage("wrapping_up");

      // Only cancel if AI is actively generating a response — avoids "no active response" error
      if (aiSpeaking) {
        sendEvent({ type: "response.cancel" });
      }
      clearAudioBuffer();
      sendTextMessage(
        "The interview is ending now. Please wrap up briefly — thank the candidate for their time and let them know the team will review and get back to them. Keep it to 2-3 sentences."
      );
    } else {
      // Connection already lost — go straight to evaluation
      await disconnect();
      const { error } = await supabase.from("interviews").update({
        status: "completed",
        ended_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) {
        console.error("Failed to mark interview completed:", error);
        toast.error("Could not save interview completion. Please contact your recruiter.");
      }
      setInterview(p => p ? { ...p, status: "completed" } : null);
      clearInterval(timerRef.current);
      evaluateInterview();
    }
  }, [id, isConnected, aiSpeaking, sendEvent, clearAudioBuffer, sendTextMessage, stopDeepgram, disconnect, evaluateInterview]);

  // ─── Submit typed text ─────────────────────────────────────────────────────

  const submitManual = () => {
    const text = manualInput.trim();
    if (!text) return;
    setManualInput("");
    setShowManual(false);
    addTranscriptEntry("Candidate", text);
    sendTextMessage(text);
  };

  // ─── Mock mode: "Done Speaking" handler ────────────────────────────────────

  const handleDoneSpeaking = useCallback(() => {
    if (!isMockMode) return;

    // Set ref SYNCHRONOUSLY so callbacks see correct phase immediately
    questionPhaseRef.current = "processing";
    setMicLocked(true);
    setQuestionPhase("processing");
    // Clear any live user text immediately — mic is now off
    setUserLiveText("");
    setUserTranscribing(false);

    console.log("[MockMode] Done Speaking clicked → phase=processing, mic locked");

    // Commit any remaining audio in the buffer. With server_vad + create_response:false,
    // VAD auto-transcribes speech but doesn't auto-respond — we control responses manually.
    commitAudioBuffer();

    const curQ = currentQuestionRef.current;

    if (questions.length > 0 && curQ >= questions.length - 1) {
      // All questions answered — wrap up
      wrappingUpRef.current = true;
      setStage("wrapping_up");
      stopDeepgram();
      setUserLiveText("");
      setUserTranscribing(false);
      micStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
      clearAudioBuffer();
      console.log("[MockMode] All questions done → wrapping up");
      sendTextMessage("WRAP_UP");
    } else {
      // Move to next question
      const nextQ = curQ + 1;
      setCurrentQuestion(nextQ);
      questionPhaseRef.current = "ai_speaking"; // Set ref synchronously
      setQuestionPhase("ai_speaking");
      console.log(`[MockMode] → AI asking question ${nextQ + 1}`);
      sendTextMessage(
        `ASK_QUESTION:${nextQ + 1} — "${questions[nextQ]?.text}"`
      );
    }
  }, [isMockMode, questions, commitAudioBuffer, sendTextMessage, stopDeepgram]);

  // In mock mode, suppress all userSpeaking UI unless it's the user's turn.
  // This prevents background noise from lighting up avatar rings, PiP dots, etc.
  const effectiveUserSpeaking = isMockMode && questionPhase !== "user_answering" ? false : userSpeaking;

  // ─── Status label ──────────────────────────────────────────────────────────

  const statusInfo = (() => {
    if (isConnecting)              return { text: "Connecting...",            dot: "bg-amber-400",   pulse: true };
    if (stage === "wrapping_up")   return { text: "Wrapping up...",          dot: "bg-amber-400",   pulse: true };
    if (isMockMode && questionPhase === "processing") return { text: "Processing...",  dot: "bg-amber-400",  pulse: true };
    if (aiSpeaking)                return { text: "Alex is speaking",        dot: "bg-violet-400",  pulse: true };
    if (isMockMode && questionPhase === "user_answering") return { text: "Your turn — click Done Speaking when finished", dot: "bg-emerald-400", pulse: true };
    if (effectiveUserSpeaking)     return { text: "Listening...",            dot: "bg-emerald-400", pulse: true };
    if (isConnected && !isMockMode) return { text: "Ready — speak anytime",  dot: "bg-emerald-400", pulse: false };
    if (isConnected && isMockMode) return { text: "Listening...",            dot: "bg-emerald-400", pulse: false };
    if (stage === "evaluating")    return { text: "Generating evaluation...", dot: "bg-violet-400", pulse: true };
    if (stage === "completed")     return { text: "Interview complete",       dot: "bg-emerald-400", pulse: false };
    return { text: "Ready to begin", dot: "bg-slate-500", pulse: false };
  })();

  // ─── Guards ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <p className="text-slate-400 text-sm">Loading interview room...</p>
      </div>
    </div>
  );

  if (permissionDenied) return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <MicOff className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Permissions Required</h2>
        <p className="text-slate-400 text-sm">Camera and microphone access is required. Please allow and reload.</p>
        <Button onClick={() => window.location.reload()} className="bg-violet-600 hover:bg-violet-700 text-white">Reload Page</Button>
      </div>
    </div>
  );

  const isLive = stage === "live" || stage === "wrapping_up";
  const flowIdx = FLOW_INDEX[stage];

  // Show all entries (including the live in-progress AI entry which has is_final: false)
  const displayTranscript = transcript;

  // ─── Evaluating overlay ────────────────────────────────────────────────────

  if (stage === "evaluating") return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712]">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 max-w-md px-8">
        <div className="relative mx-auto w-24 h-24">
          <motion.div className="absolute inset-0 rounded-full bg-violet-500/20"
            animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
            <NeuralSVG className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Evaluating Interview</h2>
          <p className="text-slate-400">Alex is reviewing your responses and generating a comprehensive evaluation...</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-violet-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
        <p className="text-xs text-slate-600">This usually takes 10–15 seconds</p>
      </motion.div>
    </div>
  );

  // ─── Completed screen ─────────────────────────────────────────────────────

  if (stage === "completed") return (
    <div className="min-h-screen bg-[#030712] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/interviews")} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
            <ChevronRight className="h-4 w-4 rotate-180" />Back
          </button>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-sm font-medium text-white">{candidate?.full_name}</span>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Interview Complete</Badge>
        </div>
        <span className="font-mono text-sm text-slate-500">{fmt(timer)}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">Interview Completed</h1>
            <p className="text-slate-400 max-w-lg mx-auto">{evalSummary || `${candidate?.full_name}'s interview has been recorded and evaluated.`}</p>
          </motion.div>

          {scores.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Evaluation Results</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scores.map((s, i) => (
                  <motion.div key={s.dimension} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}
                    className={`rounded-2xl border p-5 space-y-3 ${scoreBg(s.score)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{s.dimension}</span>
                      <div className={`flex items-center gap-1 ${scoreColor(s.score)}`}>
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <span className="text-lg font-bold">{s.score}</span>
                        <span className="text-xs opacity-60">/10</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${scoreBar(s.score)}`}
                        initial={{ width: 0 }} animate={{ width: `${s.score * 10}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 + i * 0.08 }} />
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{s.evidence}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {transcript.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              <div className="flex items-center gap-2 mb-5">
                <MessageSquare className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Full Transcript</h2>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4">
                {transcript.filter(t => t.is_final).map(e => (
                  <div key={e.id} className={`rounded-xl p-3 text-sm ${e.speaker === "AI" ? "bg-violet-500/8 border border-violet-500/12 ml-4" : "bg-white/[0.03] border border-white/[0.05] mr-4"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${e.speaker === "AI" ? "text-violet-400" : "text-emerald-400"}`}>
                      {e.speaker === "AI" ? "Alex (AI Interviewer)" : candidate?.full_name ?? "Candidate"}
                    </p>
                    <p className="text-slate-300 leading-relaxed">{e.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <div className="flex justify-center pb-8">
            <Button onClick={() => navigate(isMockMode ? "/spaces" : "/interviews")} className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl text-sm font-semibold">
              {isMockMode ? "Back to Spaces" : "Back to Interviews"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Live interview room ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#030712] text-white overflow-hidden">

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl shrink-0">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/interviews")} className="text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white truncate">{candidate?.full_name ?? "Interview"}</p>
            <p className="text-[11px] text-slate-500 truncate">{candidate?.email}</p>
          </div>
          {interview?.status === "live" && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE
            </span>
          )}
        </div>

        {/* Center — flow steps */}
        <div className="hidden md:flex items-center gap-1">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                i === flowIdx ? "bg-violet-600/30 text-violet-300 border border-violet-500/40" :
                i < flowIdx  ? "text-emerald-400" : "text-slate-600"
              }`}>
                {i < flowIdx && <CheckCircle2 className="h-3 w-3" />}
                {step.label}
              </span>
              {i < FLOW_STEPS.length - 1 && <div className={`w-4 h-px ${i < flowIdx ? "bg-emerald-500/30" : "bg-white/[0.06]"}`} />}
            </div>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {questions.length > 0 && isLive && (
            <span className="text-[11px] text-slate-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-2.5 py-1">
              {isMockMode ? `Question ${Math.min(currentQuestion + 1, questions.length)} of ${questions.length}` : `${questions.length} questions`}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm font-mono text-slate-300">
            <Clock className="h-3.5 w-3.5 text-slate-500" />{fmt(timer)}
          </span>
          <button onClick={() => setShowTranscript(v => !v)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
            <MessageSquare className="h-4 w-4" />
          </button>
          {isLive && (
            <button onClick={endInterview} className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-full px-3 py-1.5 transition-all">
              <PhoneOff className="h-3.5 w-3.5" />End
            </button>
          )}
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-1 min-h-0">

        {/* AI + Candidate area */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] transition-colors duration-1000 ${
              aiSpeaking ? "bg-violet-700/10" : effectiveUserSpeaking ? "bg-emerald-700/8" : "bg-violet-900/5"
            }`} />
          </div>

          {/* AI Avatar */}
          <div className="relative flex flex-col items-center gap-5 z-10 w-full max-w-xl px-6">
            {/* Avatar rings */}
            <div className="relative">
              <AnimatePresence>
                {aiSpeaking && (
                  <>
                    <motion.div key="r1" className="absolute inset-0 rounded-full border border-violet-400/20"
                      animate={{ scale: [1, 1.5, 2], opacity: [0.5, 0.2, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }} />
                    <motion.div key="r2" className="absolute inset-0 rounded-full border border-violet-400/15"
                      animate={{ scale: [1, 1.4, 1.8], opacity: [0.4, 0.15, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.3 }} />
                  </>
                )}
                {effectiveUserSpeaking && (
                  <motion.div key="lr" className="absolute inset-0 rounded-full border-2 border-emerald-400/30"
                    animate={{ scale: [1, 1.25], opacity: [0.6, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }} />
                )}
              </AnimatePresence>

              {/* Main avatar circle */}
              <motion.div className="relative h-32 w-32 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#6d28d9 0%,#4f46e5 50%,#7c3aed 100%)" }}
                animate={aiSpeaking
                  ? { boxShadow: ["0 0 30px rgba(124,58,237,0.4)","0 0 70px rgba(124,58,237,0.8)","0 0 30px rgba(124,58,237,0.4)"] }
                  : effectiveUserSpeaking
                  ? { boxShadow: ["0 0 20px rgba(16,185,129,0.3)","0 0 40px rgba(16,185,129,0.5)","0 0 20px rgba(16,185,129,0.3)"] }
                  : { boxShadow: "0 0 20px rgba(124,58,237,0.15)" }}
                transition={{ duration: 1.5, repeat: Infinity }}>
                <NeuralSVG className="h-14 w-14 text-white/90" />
                {isConnecting && (
                  <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Name + status */}
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold tracking-wide">Alex</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest">AI Interviewer · Realtime Voice</p>
              <motion.div key={statusInfo.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 mt-2">
                <div className={`w-2 h-2 rounded-full ${statusInfo.dot} ${statusInfo.pulse ? "animate-pulse" : ""}`} />
                <span className="text-sm font-medium text-slate-300">{statusInfo.text}</span>
              </motion.div>
            </div>

            {/* Animated voice bars when AI speaks */}
            <AnimatePresence>
              {aiSpeaking && (
                <motion.div key="bars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-1 h-8">
                  {[...Array(9)].map((_, i) => (
                    <motion.div key={i} className="w-1.5 bg-violet-400 rounded-full"
                      animate={{ height: ["6px", `${10 + Math.random() * 20}px`, "6px"] }}
                      transition={{ duration: 0.4 + i * 0.06, repeat: Infinity, ease: "easeInOut", delay: i * 0.07 }} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live AI speech — word-by-word as Alex speaks */}
            <AnimatePresence>
              {aiLiveText && (
                <motion.div key="ai-caption" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="w-full bg-violet-500/10 border border-violet-500/20 rounded-2xl px-5 py-4 backdrop-blur-sm min-h-[60px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wide">Alex speaking</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    <span className="text-slate-200 leading-relaxed">{aiLiveText}</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* User speaking / transcribing indicator with live text */}
            <AnimatePresence>
              {(effectiveUserSpeaking || userTranscribing || userLiveText) && isLive && (!isMockMode || questionPhase === "user_answering") && (
                <motion.div key="user-live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4 backdrop-blur-sm min-h-[60px]">
                  <div className="flex items-center gap-2 mb-2">
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={effectiveUserSpeaking ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }} />
                    <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">
                      {effectiveUserSpeaking ? "You are speaking" : userTranscribing ? "Transcribing..." : candidate?.full_name ?? "You"}
                    </span>
                    {userTranscribing && !userLiveText && (
                      <Loader2 className="h-3 w-3 text-emerald-400 animate-spin" />
                    )}
                  </div>

                  {/* Live interim text from Deepgram */}
                  {userLiveText && (
                    <p className="text-sm text-slate-200 leading-relaxed">
                      <span className="text-slate-200">{userLiveText}</span>
                      {effectiveUserSpeaking && <span className="inline-block w-0.5 h-4 bg-emerald-400 rounded-full align-middle animate-pulse ml-1" />}
                    </p>
                  )}

                  {/* Waveform only when speaking and no text yet */}
                  {effectiveUserSpeaking && !userLiveText && micStream && (
                    <div className="mt-1">
                      <AudioWaveform stream={micStream} isActive={effectiveUserSpeaking} barCount={20} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start button */}
            {stage === "pre_interview" && (
              <motion.button onClick={startInterview} disabled={isConnecting || !micStream}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-2xl shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : !micStream ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {!micStream ? "Initializing Mic..." : "Start Interview"}
              </motion.button>
            )}

            {/* Mock mode: "Done Speaking" button */}
            {isMockMode && isLive && questionPhase === "user_answering" && !aiSpeaking && (
              <motion.button
                onClick={handleDoneSpeaking}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-8 py-3 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Done Speaking
              </motion.button>
            )}

            {/* Type-instead option during live interview */}
            {isLive && !aiSpeaking && !effectiveUserSpeaking && (!isMockMode || questionPhase === "user_answering") && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowManual(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-full px-4 py-2.5 transition-all">
                  <MessageSquare className="h-3.5 w-3.5" />Type Instead
                </button>
              </div>
            )}

            {/* Text input fallback */}
            <AnimatePresence>
              {showManual && isLive && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="w-full flex items-center gap-2 bg-black/60 border border-white/10 rounded-xl p-2 backdrop-blur-xl">
                  <input value={manualInput} onChange={e => setManualInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitManual()}
                    placeholder="Type your answer and press Enter..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-2" autoFocus />
                  <button onClick={submitManual} disabled={!manualInput.trim()}
                    className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors">
                    <Send className="h-3.5 w-3.5 text-white" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Candidate PiP */}
          <div className="absolute bottom-20 left-5">
            <div className="relative w-44 h-32 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!cameraEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-1.5">
                  <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{candidate?.full_name?.charAt(0) ?? "C"}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Camera off</p>
                </div>
              )}
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
                <span className="text-[10px] text-white/60 font-medium truncate">{candidate?.full_name ?? "You"}</span>
                {effectiveUserSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <ControlBtn
              active={micEnabled && !(isMockMode && micLocked)}
              onClick={() => { if (!(isMockMode && micLocked)) toggleMic(); }}
              activeIcon={<Mic className="h-4 w-4" />}
              offIcon={<MicOff className="h-4 w-4 text-red-400" />}
              disabled={isMockMode && micLocked}
            />
            <ControlBtn active={cameraEnabled} onClick={toggleCamera} activeIcon={<Video className="h-4 w-4" />} offIcon={<VideoOff className="h-4 w-4 text-red-400" />} />
          </div>
        </div>

        {/* TRANSCRIPT PANEL */}
        <AnimatePresence>
          {showTranscript && (
            <motion.div key="panel" initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              className="flex flex-col border-l border-white/[0.06] bg-black/20 backdrop-blur-xl shrink-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">Transcript</span>
                  <span className="text-[10px] bg-white/[0.06] rounded-full px-2 py-0.5 text-slate-400">{transcript.filter(t => t.is_final).length}</span>
                  {(aiLiveText || effectiveUserSpeaking || userTranscribing || userLiveText) && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5 animate-pulse">Live</span>
                  )}
                </div>
                <button onClick={() => setShowTranscript(false)} className="p-1 text-slate-500 hover:text-white transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[200px]">
                {displayTranscript.length === 0 && !aiLiveText && !effectiveUserSpeaking ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <MessageSquare className="h-10 w-10 text-white/10 mb-3" />
                    <p className="text-xs text-slate-500">Transcript appears here during the interview</p>
                  </div>
                ) : (
                  <>
                  {displayTranscript.map(e => (
                    <motion.div key={e.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl p-3 text-xs leading-relaxed ${
                        e.speaker === "AI"
                          ? "bg-violet-500/8 border border-violet-500/12 ml-3"
                          : "bg-white/[0.03] border border-white/[0.05] mr-3"
                      }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {e.speaker === "AI" && !e.is_final && (
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
                        )}
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${e.speaker === "AI" ? "text-violet-400" : "text-emerald-400"}`}>
                          {e.speaker === "AI" ? "Alex (AI)" : candidate?.full_name ?? "Candidate"}
                        </p>
                      </div>
                      <span className="text-slate-200">{e.text}</span>
                      {e.speaker === "AI" && !e.is_final && (
                        <span className="inline-block w-0.5 h-3 bg-violet-400 rounded-full align-middle animate-pulse ml-0.5" />
                      )}
                    </motion.div>
                  ))}

                  {/* User speaking / transcribing in sidebar */}
                  <AnimatePresence>
                    {(effectiveUserSpeaking || userTranscribing || userLiveText) && (!isMockMode || questionPhase === "user_answering") && (
                      <motion.div key="user-live-sidebar" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="rounded-xl p-3 text-xs bg-white/[0.03] border border-white/[0.05] mr-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                            animate={effectiveUserSpeaking ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
                            transition={{ duration: 1, repeat: Infinity }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                            {effectiveUserSpeaking ? `${candidate?.full_name ?? "Candidate"} speaking...`
                             : userTranscribing ? "Transcribing..."
                             : candidate?.full_name ?? "Candidate"}
                          </span>
                          {userTranscribing && !userLiveText && (
                            <Loader2 className="h-2.5 w-2.5 text-emerald-400 animate-spin" />
                          )}
                        </div>
                        {userLiveText && (
                          <p className="text-xs leading-relaxed">
                            <span className="text-slate-300">{userLiveText}</span>
                            {effectiveUserSpeaking && <span className="inline-block w-0.5 h-3 bg-emerald-400 rounded-full align-middle animate-pulse ml-1" />}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  </>
                )}
              </div>

              {/* Mic waveform in sidebar */}
              {isConnected && !effectiveUserSpeaking && (
                <div className="border-t border-white/[0.06] px-4 py-3 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isMockMode && micLocked ? "bg-slate-500" : isConnected ? "bg-emerald-400" : "bg-slate-500"
                    } ${isConnected && !(isMockMode && micLocked) ? "animate-pulse" : ""}`} />
                    <span className={`text-[10px] font-medium uppercase tracking-wide ${
                      isMockMode && micLocked ? "text-slate-500" : "text-emerald-400"
                    }`}>
                      {isMockMode && micLocked ? "Microphone Off — Alex's Turn" : micEnabled ? "Microphone Active" : "Microphone Muted"}
                    </span>
                  </div>
                  <AudioWaveform stream={micStream} isActive={isConnected && micEnabled && !(isMockMode && micLocked)} barCount={20} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ControlBtn({ active, onClick, activeIcon, offIcon, disabled }: {
  active: boolean; onClick: () => void;
  activeIcon: React.ReactNode; offIcon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
      disabled ? "opacity-40 cursor-not-allowed bg-white/[0.04] border border-white/[0.06]" :
      active ? "bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08]" : "bg-red-500/15 hover:bg-red-500/25 border border-red-500/25"
    }`}>
      {active ? activeIcon : offIcon}
    </button>
  );
}

function NeuralSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <circle cx="32" cy="32" r="18" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      {[[32,14],[48,23],[48,41],[32,50],[16,41],[16,23]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="white" fillOpacity="0.75" />
      ))}
      {[[32,14,48,23],[48,23,48,41],[48,41,32,50],[32,50,16,41],[16,41,16,23],[16,23,32,14]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      ))}
      {[[32,14,32,32],[48,23,32,32],[48,41,32,32],[32,50,32,32],[16,41,32,32],[16,23,32,32]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="2 2" />
      ))}
      <circle cx="32" cy="32" r="4.5" fill="white" fillOpacity="0.9" />
      <circle cx="32" cy="32" r="8" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 2" />
    </svg>
  );
}
