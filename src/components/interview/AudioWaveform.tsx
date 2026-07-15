import { useEffect, useRef } from "react";

interface AudioWaveformProps {
  stream: MediaStream | null;
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export function AudioWaveform({
  stream,
  isActive,
  barCount = 24,
  className = "",
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !isActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      drawFlatLine();
      return;
    }

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyserRef.current = analyser;
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / barCount) * 0.6;
      const gap = (width / barCount) * 0.4;
      const step = Math.floor(dataArray.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const barHeight = Math.max(3, value * height * 0.85);
        const x = i * (barWidth + gap) + gap / 2;
        const y = (height - barHeight) / 2;

        // Gradient from primary color to lighter
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, "hsl(250 84% 74%)");
        gradient.addColorStop(1, "hsl(250 84% 54%)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioCtx.close();
    };
  }, [stream, isActive, barCount]);

  const drawFlatLine = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barWidth = (width / barCount) * 0.6;
    const gap = (width / barCount) * 0.4;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap) + gap / 2;
      const barHeight = 3;
      const y = (height - barHeight) / 2;
      ctx.fillStyle = "hsl(var(--muted-foreground) / 0.2)";
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={48}
      className={`w-full h-12 ${className}`}
    />
  );
}
