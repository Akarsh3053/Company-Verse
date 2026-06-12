"use client";

import { useEffect, useRef, useState } from "react";

interface TypewriterProps {
  text: string;
  /** Characters per second. */
  speed?: number;
  className?: string;
  /** Called once the full text has been revealed. */
  onDone?: () => void;
  /** When true, reveal everything immediately (e.g. on a second click). */
  skip?: boolean;
}

/**
 * Reveals text character-by-character for a retro cutscene/dialogue feel. Honours
 * a `skip` flag so a tap can fast-forward to the full line.
 */
export default function Typewriter({
  text,
  speed = 45,
  className,
  onDone,
  skip = false,
}: TypewriterProps) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setCount(0);
    doneRef.current = false;
  }, [text]);

  useEffect(() => {
    if (skip) {
      setCount(text.length);
      return;
    }
    if (count >= text.length) return;
    const interval = window.setInterval(
      () => setCount((c) => Math.min(text.length, c + 1)),
      1000 / speed,
    );
    return () => window.clearInterval(interval);
  }, [count, skip, speed, text.length]);

  useEffect(() => {
    if (count >= text.length && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [count, text.length, onDone]);

  const revealed = skip ? text : text.slice(0, count);
  const complete = revealed.length >= text.length;

  return (
    <span className={className}>
      {revealed}
      {!complete && <span className="animate-blink">▍</span>}
    </span>
  );
}
