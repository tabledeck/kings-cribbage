import { useCallback, useEffect, useRef, useState } from "react";

type SoundName = "place" | "score" | "yourTurn" | "gameOver" | "chat";

function createTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.15,
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playPlaceSound(ctx: AudioContext) {
  createTone(ctx, 440, 0.08, "square", 0.08);
}

function playScoreSound(ctx: AudioContext) {
  // Rising chime: C5 → E5 → G5
  [523, 659, 784].forEach((freq, i) => {
    setTimeout(() => createTone(ctx, freq, 0.2, "sine", 0.12), i * 80);
  });
}

function playYourTurnSound(ctx: AudioContext) {
  createTone(ctx, 660, 0.15, "sine", 0.1);
  setTimeout(() => createTone(ctx, 880, 0.15, "sine", 0.1), 120);
}

function playGameOverSound(ctx: AudioContext) {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => createTone(ctx, freq, 0.3, "sine", 0.15), i * 100);
  });
}

function playChatSound(ctx: AudioContext) {
  createTone(ctx, 880, 0.06, "sine", 0.06);
}

export function useSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sounds-muted") === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Create AudioContext on first user interaction
    const init = () => {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
    };
    window.addEventListener("pointerdown", init, { once: true });
    return () => window.removeEventListener("pointerdown", init);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem("sounds-muted", String(next));
      return next;
    });
  }, []);

  const play = useCallback(
    (sound: SoundName) => {
      if (muted) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      switch (sound) {
        case "place": playPlaceSound(ctx); break;
        case "score": playScoreSound(ctx); break;
        case "yourTurn": playYourTurnSound(ctx); break;
        case "gameOver": playGameOverSound(ctx); break;
        case "chat": playChatSound(ctx); break;
      }
    },
    [muted],
  );

  return { play, muted, toggleMute };
}
