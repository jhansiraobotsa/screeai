import { useRef, useState, useCallback, useEffect } from "react";

interface UseTTSOptions {
  onEnd?: () => void;
  onChunkEnd?: (text: string) => void;
  openAIKey?: string;
}

interface UseTTSReturn {
  speak: (text: string) => void;
  cancel: () => void;
  speaking: boolean;
  usingOpenAI: boolean;
}

async function speakWithOpenAI(text: string, apiKey: string): Promise<HTMLAudioElement> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", input: text, voice: "nova" }),
  });
  if (!response.ok) throw new Error("OpenAI TTS failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  return audio;
}

export function useTTS({ onEnd, onChunkEnd, openAIKey }: UseTTSOptions = {}): UseTTSReturn {
  const [speaking, setSpeaking] = useState(false);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | HTMLAudioElement | null>(null);
  const cancelledRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const onChunkEndRef = useRef(onChunkEnd);
  useEffect(() => { onChunkEndRef.current = onChunkEnd; }, [onChunkEnd]);

  const usingOpenAI = Boolean(openAIKey);

  // Pick best browser voice (fallback)
  useEffect(() => {
    const pick = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      voiceRef.current =
        voices.find((v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google US English") ||
            v.name.includes("Neural") ||
            v.name.includes("Enhanced") ||
            v.name.includes("Samantha"))
        ) ??
        voices.find((v) => v.lang === "en-US") ??
        voices.find((v) => v.lang.startsWith("en")) ??
        null;
    };
    pick();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = pick;
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    cancelledRef.current = false;
    setSpeaking(true);

    while (queueRef.current.length > 0 && !cancelledRef.current) {
      const text = queueRef.current.shift()!;

      if (openAIKey) {
        try {
          const audio = await speakWithOpenAI(text, openAIKey);
          currentAudioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        } catch {
          // Fallback to browser
          await browserSpeak(text, voiceRef.current);
        }
      } else {
        await browserSpeak(text, voiceRef.current);
      }

      // Fire after each chunk finishes — used to reveal spoken text in sidebar
      if (!cancelledRef.current) onChunkEndRef.current?.(text);
    }

    processingRef.current = false;
    setSpeaking(false);
    if (!cancelledRef.current) onEnd?.();
  }, [openAIKey, onEnd]);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      queueRef.current.push(text);
      processQueue();
    },
    [processQueue]
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    processingRef.current = false;
    setSpeaking(false);
  }, []);

  return { speak, cancel, speaking, usingOpenAI };
}

function browserSpeak(text: string, voice: SpeechSynthesisVoice | null): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 0.92;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
