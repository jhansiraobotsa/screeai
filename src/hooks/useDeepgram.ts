import { useRef, useState, useCallback, useEffect } from "react";
import { cleanTranscript } from "@/lib/transcriptClean";

// Minimum Deepgram confidence to accept a final result. Hallucinated foreign
// text on noise/silence comes back with low confidence.
const MIN_CONFIDENCE = 0.6;



interface UseDeepgramOptions {
  apiKey: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseDeepgramReturn {
  start: (stream: MediaStream) => void;
  stop: () => void;
  isListening: boolean;
  isConnecting: boolean;
}

export function useDeepgram({
  apiKey,
  onInterim,
  onFinal,
  onError,
}: UseDeepgramOptions): UseDeepgramReturn {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Use refs for callbacks — always call latest version, no stale closures
  const onInterimRef = useRef(onInterim);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef<string>("");
  const streamRef = useRef<MediaStream | null>(null);
  // activeRef = should we be actively listening? Survives reconnects.
  const activeRef = useRef(false);

  const teardownAudio = useCallback(() => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});
    processorRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;
  }, []);

  // Core connect — creates WS + audio pipeline for the given stream
  const connect = useCallback((stream: MediaStream) => {
    // Close any existing WS without triggering auto-reconnect
    if (wsRef.current) {
      const old = wsRef.current;
      old.onclose = null;
      old.onerror = null;
      if (old.readyState === WebSocket.OPEN || old.readyState === WebSocket.CONNECTING) {
        old.close(1000);
      }
      wsRef.current = null;
    }
    teardownAudio();

    setIsConnecting(true);
    setIsListening(false);

    const params = new URLSearchParams({
      model: "nova-2",
      language: "en-US",
      interim_results: "true",
      endpointing: "800",
      utterance_end_ms: "1200",
      smart_format: "true",
      punctuate: "true",
      no_delay: "true",
    });

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params}`,
      ["token", apiKey]
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsListening(true);
      setIsConnecting(false);

      keepAliveRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "KeepAlive" }));
        }
      }, 3000);

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(floatTo16BitPCM(e.inputBuffer.getChannelData(0)).buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "UtteranceEnd") {
          const text = accumulatedRef.current.trim();
          if (text) { accumulatedRef.current = ""; onFinalRef.current(text); }
          return;
        }

        if (msg.type !== "Results") return;

        const alt = msg.channel?.alternatives?.[0];
        const rawTranscript: string = alt?.transcript ?? "";
        if (!rawTranscript) return;

        // Drop hallucinated non-English/gibberish text.
        const transcript = cleanTranscript(rawTranscript);
        if (!transcript) return;

        // For finalized results, also require decent confidence — low-confidence
        // finals are where foreign-language hallucinations come from.
        if (msg.is_final && typeof alt?.confidence === "number" && alt.confidence < MIN_CONFIDENCE) {
          return;
        }

        if (msg.is_final) {
          accumulatedRef.current = (accumulatedRef.current + " " + transcript).trim();
          if (msg.speech_final) {
            const full = accumulatedRef.current.trim();
            accumulatedRef.current = "";
            if (full) onFinalRef.current(full);
          } else {
            onInterimRef.current(accumulatedRef.current);
          }
        } else {
          onInterimRef.current((accumulatedRef.current + " " + transcript).trim());
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      // onclose will follow — handle everything there
    };

    ws.onclose = (e) => {
      setIsListening(false);
      setIsConnecting(false);
      teardownAudio();

      // Auto-reconnect if we should still be listening (i.e. not a clean stop())
      if (activeRef.current && streamRef.current && e.code !== 1000) {
        reconnectTimerRef.current = setTimeout(() => {
          if (activeRef.current && streamRef.current) {
            connect(streamRef.current);
          }
        }, 800);
      }
    };
  }, [apiKey, teardownAudio]);

  const start = useCallback((stream: MediaStream) => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    activeRef.current = true;
    streamRef.current = stream;
    accumulatedRef.current = "";
    connect(stream);
  }, [connect]);

  const stop = useCallback(() => {
    activeRef.current = false;
    streamRef.current = null;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    accumulatedRef.current = "";
    teardownAudio();

    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CloseStream" }));
        ws.close(1000);
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000);
      }
      wsRef.current = null;
    }

    setIsListening(false);
    setIsConnecting(false);
  }, [teardownAudio]);

  return { start, stop, isListening, isConnecting };
}

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
