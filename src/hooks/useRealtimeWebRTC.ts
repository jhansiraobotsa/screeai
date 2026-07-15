import { useRef, useState, useCallback, useEffect } from "react";
import { cleanTranscript } from "@/lib/transcriptClean";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export interface UseRealtimeOptions {
  tokenUrl?: string;
  onUserTranscript?: (text: string) => void;
  onAITranscriptDelta?: (delta: string, accumulated: string) => void;
  onAITranscriptDone?: (text: string) => void;
  onAISpeakingChange?: (speaking: boolean) => void;
  onUserSpeakingChange?: (speaking: boolean) => void;
  onError?: (error: string) => void;
  onEvent?: (event: RealtimeEvent) => void;
}

export interface UseRealtimeReturn {
  connect: (micStream: MediaStream) => Promise<void>;
  disconnect: () => Promise<void>;
  updateSession: (config: Record<string, unknown>) => void;
  sendEvent: (event: Record<string, unknown>) => void;
  sendTextMessage: (text: string) => void;
  triggerResponse: () => void;
  interruptResponse: () => void;
  commitAudioBuffer: () => void;
  clearAudioBuffer: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  aiSpeaking: boolean;
  userSpeaking: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useRealtimeWebRTC(options: UseRealtimeOptions): UseRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const aiTranscriptRef = useRef("");
  const callIdRef = useRef<string | null>(null);
  const sessionGenRef = useRef(0);
  const connectPromiseRef = useRef<Promise<void> | null>(null);

  // Always call latest callbacks — avoids stale closures
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // ── Send event via data channel ─────────────────────────────────────────────

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState === "open") {
      dc.send(JSON.stringify(event));
    }
  }, []);

  const hangupCall = useCallback(async (callId: string) => {
    try {
      await fetch("/api/realtime/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      console.log("[Realtime] Server hangup sent for call:", callId);
    } catch (err) {
      console.warn("[Realtime] Hangup request failed:", err);
    }
  }, []);

  const closeLocalConnection = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {}
    try {
      pcRef.current?.close();
    } catch {}
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    pcRef.current = null;
    dcRef.current = null;
    aiTranscriptRef.current = "";
    setIsConnected(false);
    setIsConnecting(false);
    setAiSpeaking(false);
    setUserSpeaking(false);
  }, []);

  const isSessionStale = useCallback((generation: number) => {
    return generation !== sessionGenRef.current;
  }, []);

  const exchangeSdp = useCallback(async (offerSdp: string, ephemeralKey: string) => {
    const response = await fetch("/api/realtime/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdp: offerSdp, ephemeralKey }),
    });

    const data = await response.json().catch(() => ({})) as {
      sdp?: string;
      callId?: string | null;
      error?: string;
    };

    if (!response.ok) {
      throw Object.assign(
        new Error(data.error ?? `WebRTC connection failed: ${response.status}`),
        { status: response.status, callId: data.callId ?? null }
      );
    }

    if (!data.sdp) {
      throw new Error("No SDP answer received from realtime connect proxy");
    }

    return { answerSdp: data.sdp, callId: data.callId ?? null };
  }, []);

  // ── Handle incoming server events ───────────────────────────────────────────

  const handleServerEvent = useCallback((event: RealtimeEvent) => {
    const opts = optionsRef.current;
    const ev = event as Record<string, unknown>;

    console.log("[Realtime] Event:", event.type);

    switch (event.type) {
      // ── User speech detection ────────────────────────────────
      case "input_audio_buffer.speech_started":
        setUserSpeaking(true);
        opts.onUserSpeakingChange?.(true);
        break;

      case "input_audio_buffer.speech_stopped":
        setUserSpeaking(false);
        opts.onUserSpeakingChange?.(false);
        break;

      // ── AI response lifecycle ────────────────────────────────
      case "response.created":
        setAiSpeaking(true);
        opts.onAISpeakingChange?.(true);
        break;

      // Audio transcript streaming (word-by-word as AI speaks)
      // GA event name: response.output_audio_transcript.delta
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta": {
        const delta = (ev.delta as string) ?? "";
        if (delta) {
          aiTranscriptRef.current += delta;
          setAiSpeaking(true);
          opts.onAITranscriptDelta?.(delta, aiTranscriptRef.current);
        }
        break;
      }

      // Text response streaming
      // GA event name: response.output_text.delta
      case "response.output_text.delta":
      case "response.text.delta": {
        const delta = (ev.delta as string) ?? "";
        if (delta) {
          aiTranscriptRef.current += delta;
          setAiSpeaking(true);
          opts.onAITranscriptDelta?.(delta, aiTranscriptRef.current);
        }
        break;
      }

      // Full response complete — extract transcript from payload as authoritative source
      case "response.done": {
        let finalText = aiTranscriptRef.current.trim();

        // Fallback: extract transcript from response.done payload
        // The response object contains output items with transcript text
        if (!finalText) {
          try {
            const resp = ev.response as { output?: Array<{ content?: Array<{ transcript?: string; text?: string; type?: string }> }> } | undefined;
            if (resp?.output) {
              const parts: string[] = [];
              for (const item of resp.output) {
                if (item.content) {
                  for (const c of item.content) {
                    const t = c.transcript ?? c.text ?? "";
                    if (t) parts.push(t);
                  }
                }
              }
              finalText = parts.join(" ").trim();
            }
          } catch {
            // ignore parse errors
          }
        }

        aiTranscriptRef.current = "";
        // NOTE: keep aiSpeaking=true here — audio is still playing.
        // onAISpeakingChange(false) is fired by output_audio_buffer.audio_stopped instead.
        if (finalText) {
          console.log("[Realtime] AI transcript:", finalText.substring(0, 80) + "...");
          opts.onAITranscriptDone?.(finalText);
        }
        break;
      }

      // Audio playback actually finished — NOW it's safe to unlock mic
      case "output_audio_buffer.audio_stopped":
        setAiSpeaking(false);
        opts.onAISpeakingChange?.(false);
        break;

      // Response cancelled (e.g. interrupted) — also unlock mic
      case "response.cancelled":
        aiTranscriptRef.current = "";
        setAiSpeaking(false);
        opts.onAISpeakingChange?.(false);
        break;

      // ── User transcript ──────────────────────────────────────
      case "conversation.item.input_audio_transcription.completed": {
        // Clean hallucinated non-English/gibberish before it reaches the
        // transcript record and the evaluator.
        const text = cleanTranscript((ev.transcript as string) ?? "");
        if (text) {
          console.log("[Realtime] User transcript:", text.substring(0, 80));
          opts.onUserTranscript?.(text);
        }
        break;
      }

      // ── Errors ───────────────────────────────────────────────
      case "error": {
        const errObj = ev.error as { message?: string } | undefined;
        const msg = errObj?.message ?? "Realtime API error";
        console.error("[Realtime] Error:", msg);
        opts.onError?.(msg);
        break;
      }
    }

    // Always forward raw event
    opts.onEvent?.(event);
  }, []);

  // ── Connect ─────────────────────────────────────────────────────────────────

  const connectInternal = useCallback(
    async (micStream: MediaStream): Promise<void> => {
      const generation = sessionGenRef.current;

      const priorCallId = callIdRef.current;
      callIdRef.current = null;
      closeLocalConnection();
      if (priorCallId) {
        await hangupCall(priorCallId);
        await new Promise((r) => setTimeout(r, 300));
      }

      if (isSessionStale(generation)) return;

      setIsConnecting(true);

      let timeout: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        fn();
      };

      try {
        await new Promise<void>((resolve, reject) => {
          timeout = setTimeout(() => {
            closeLocalConnection();
            finish(() => reject(new Error("Connection timed out — check your network")));
          }, 15_000);

          (async () => {
            try {
              const tokenUrl =
                optionsRef.current.tokenUrl ?? "/api/realtime/token";
              console.log("[Realtime] Fetching token...");
              const tokenRes = await fetch(tokenUrl);
              if (!tokenRes.ok) throw new Error("Failed to get realtime token");
              const tokenData = await tokenRes.json();
              const td = tokenData as Record<string, unknown>;
              const ephemeralKey =
                (td.value as string | undefined) ??
                ((td.client_secret as { value?: string } | undefined)?.value);
              if (!ephemeralKey) throw new Error("No ephemeral key received");
              console.log("[Realtime] Token received");

              if (isSessionStale(generation)) {
                finish(resolve);
                return;
              }

              const pc = new RTCPeerConnection();
              pcRef.current = pc;

              const audio = document.createElement("audio");
              audio.autoplay = true;
              audioRef.current = audio;
              pc.ontrack = (e) => {
                console.log("[Realtime] Remote audio track received");
                audio.srcObject = e.streams[0];
                audio.play().catch(() => {});
              };

              const audioTrack = micStream.getAudioTracks()[0];
              if (!audioTrack) throw new Error("No audio track in mic stream");
              pc.addTrack(audioTrack, micStream);

              const dc = pc.createDataChannel("oai-events");
              dcRef.current = dc;

              dc.addEventListener("open", () => {
                if (isSessionStale(generation)) return;
                console.log("[Realtime] Data channel open");
                setIsConnected(true);
                setIsConnecting(false);
                finish(resolve);
              });

              dc.addEventListener("message", (e) => {
                try {
                  const event: RealtimeEvent = JSON.parse(e.data);
                  handleServerEvent(event);
                } catch {
                  /* ignore parse errors */
                }
              });

              dc.addEventListener("close", () => {
                setIsConnected(false);
                setAiSpeaking(false);
              });

              let iceRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
              pc.oniceconnectionstatechange = () => {
                const state = pc.iceConnectionState;
                console.log("[Realtime] ICE state:", state);

                if (state === "connected" || state === "completed") {
                  if (iceRecoveryTimer) {
                    clearTimeout(iceRecoveryTimer);
                    iceRecoveryTimer = null;
                  }
                  setIsConnected(true);
                } else if (state === "disconnected") {
                  iceRecoveryTimer = setTimeout(() => {
                    if (
                      pc.iceConnectionState === "disconnected" ||
                      pc.iceConnectionState === "failed"
                    ) {
                      console.error("[Realtime] ICE did not recover");
                      optionsRef.current.onError?.(
                        "WebRTC connection lost — please restart the interview"
                      );
                      setIsConnected(false);
                    }
                  }, 5000);
                } else if (state === "failed") {
                  if (iceRecoveryTimer) {
                    clearTimeout(iceRecoveryTimer);
                    iceRecoveryTimer = null;
                  }
                  optionsRef.current.onError?.("WebRTC connection failed");
                  setIsConnected(false);
                  setIsConnecting(false);
                  finish(() => reject(new Error("WebRTC ICE connection failed")));
                }
              };

              console.log("[Realtime] Creating SDP offer...");
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              if (isSessionStale(generation)) {
                finish(resolve);
                return;
              }

              console.log("[Realtime] Exchanging SDP via server proxy...");
              let answerSdp: string;
              let callId: string | null;

              try {
                const result = await exchangeSdp(offer.sdp!, ephemeralKey);
                answerSdp = result.answerSdp;
                callId = result.callId;
              } catch (err) {
                const e = err as Error & { status?: number; callId?: string | null };
                if (e.status === 409) {
                  console.warn("[Realtime] Call already active — hanging up and retrying once");
                  if (e.callId) await hangupCall(e.callId);
                  await new Promise((r) => setTimeout(r, 500));

                  const retryTokenRes = await fetch(tokenUrl);
                  if (!retryTokenRes.ok) {
                    throw new Error("Failed to get realtime token on retry");
                  }
                  const retryTokenData = await retryTokenRes.json();
                  const retryTd = retryTokenData as Record<string, unknown>;
                  const retryKey =
                    (retryTd.value as string | undefined) ??
                    ((retryTd.client_secret as { value?: string } | undefined)?.value);
                  if (!retryKey) throw new Error("No ephemeral key received on retry");

                  const retry = await exchangeSdp(offer.sdp!, retryKey);
                  answerSdp = retry.answerSdp;
                  callId = retry.callId;
                } else {
                  throw err;
                }
              }

              if (isSessionStale(generation)) {
                if (callId) await hangupCall(callId);
                finish(resolve);
                return;
              }

              if (callId) {
                callIdRef.current = callId;
                console.log("[Realtime] Call established:", callId);
              }

              console.log("[Realtime] SDP answer received, setting remote description...");
              await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
              console.log("[Realtime] Remote description set, waiting for data channel...");
            } catch (err) {
              console.error("[Realtime] Connection error:", err);
              closeLocalConnection();
              const activeCallId = callIdRef.current;
              callIdRef.current = null;
              if (activeCallId) await hangupCall(activeCallId);
              finish(() =>
                reject(err instanceof Error ? err : new Error("Failed to connect"))
              );
            }
          })();
        });
      } catch (err) {
        setIsConnecting(false);
        throw err;
      }
    },
    [closeLocalConnection, exchangeSdp, hangupCall, handleServerEvent, isSessionStale]
  );

  const connect = useCallback(
    (micStream: MediaStream): Promise<void> => {
      const run = async () => {
        if (connectPromiseRef.current) {
          await connectPromiseRef.current.catch(() => {});
        }
        const promise = connectInternal(micStream);
        connectPromiseRef.current = promise;
        try {
          await promise;
        } finally {
          if (connectPromiseRef.current === promise) {
            connectPromiseRef.current = null;
          }
        }
      };
      return run();
    },
    [connectInternal]
  );

  // ── Disconnect ──────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    sessionGenRef.current++;
    const callId = callIdRef.current;
    callIdRef.current = null;
    closeLocalConnection();
    if (callId) {
      await hangupCall(callId);
    }
  }, [closeLocalConnection, hangupCall]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const updateSession = useCallback(
    (config: Record<string, unknown>) => {
      sendEvent({ type: "session.update", session: config });
    },
    [sendEvent]
  );

  const sendTextMessage = useCallback(
    (text: string) => {
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      });
      sendEvent({ type: "response.create" });
    },
    [sendEvent]
  );

  const triggerResponse = useCallback(() => {
    sendEvent({ type: "response.create" });
  }, [sendEvent]);

  const interruptResponse = useCallback(() => {
    sendEvent({ type: "response.cancel" });
  }, [sendEvent]);

  // Commit user audio buffer (required when turn_detection is null)
  const commitAudioBuffer = useCallback(() => {
    sendEvent({ type: "input_audio_buffer.commit" });
  }, [sendEvent]);

  // Clear user audio buffer without processing
  const clearAudioBuffer = useCallback(() => {
    sendEvent({ type: "input_audio_buffer.clear" });
  }, [sendEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    updateSession,
    sendEvent,
    sendTextMessage,
    triggerResponse,
    interruptResponse,
    commitAudioBuffer,
    clearAudioBuffer,
    isConnected,
    isConnecting,
    aiSpeaking,
    userSpeaking,
  };
}
