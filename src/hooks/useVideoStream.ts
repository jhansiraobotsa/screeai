import { useEffect, useRef, useState, useCallback } from "react";

interface UseVideoStreamReturn {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  micStream: MediaStream | null;
  permissionDenied: boolean;
  error: string | null;
  toggleMic: () => void;
  toggleCamera: () => void;
  micEnabled: boolean;
  cameraEnabled: boolean;
}

export function useVideoStream(): UseVideoStreamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let videoStream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;
    let cancelled = false;

    const init = async () => {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error("[Media] getUserMedia not supported in this browser/context");
        setPermissionDenied(true);
        setError("Your browser doesn't support microphone access. Use Chrome or Firefox on HTTPS/localhost.");
        return;
      }

      // Mic is requested FIRST — it's critical for the interview. Camera is optional.
      try {
        console.log("[Media] Requesting microphone...");
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { audioStream.getTracks().forEach(t => t.stop()); return; }
        console.log("[Media] Microphone acquired:", audioStream.getAudioTracks().map(t => t.label));
        setMicStream(audioStream);
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        console.error("[Media] Microphone error:", e.name, e.message);
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          setPermissionDenied(true);
          setError("Microphone access denied. Please allow microphone and reload.");
        } else {
          setError(e.message || "Could not access microphone.");
          setPermissionDenied(true);
        }
        return; // Don't bother with camera if mic failed
      }

      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) { videoStream.getTracks().forEach(t => t.stop()); return; }
        console.log("[Media] Camera acquired");
        setStream(videoStream);
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
      } catch {
        // Camera unavailable or denied — interview still works mic-only
        console.log("[Media] Camera not available (interview continues mic-only)");
      }
    };

    init();

    return () => {
      cancelled = true;
      videoStream?.getTracks().forEach((t) => t.stop());
      audioStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleMic = useCallback(() => {
    if (!micStream) return;
    micStream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicEnabled((prev) => !prev);
  }, [micStream]);

  const toggleCamera = useCallback(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCameraEnabled((prev) => !prev);
  }, [stream]);

  return {
    stream,
    videoRef,
    micStream,
    permissionDenied,
    error,
    toggleMic,
    toggleCamera,
    micEnabled,
    cameraEnabled,
  };
}
