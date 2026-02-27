"use client";

import { useCallback, useRef } from "react";

export function useAudioAlert() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAlert = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      // Play a simple two-tone notification
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15); // C#6

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio may not be available
    }
  }, []);

  return { playAlert };
}
