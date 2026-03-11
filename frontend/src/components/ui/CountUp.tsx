"use client";

/**
 * CountUp — animated number counter component.
 * Uses requestAnimationFrame with ease-out for smooth count-up on mount.
 * Renders in monospace font. No external dependencies.
 *
 * Usage: <CountUp end={51700} suffix="+" duration={1500} />
 */

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (n: number) => string;
}

function defaultFormat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n >= 1_000) return n.toLocaleString("en-US");
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function CountUp({
  end,
  duration = 1500,
  prefix = "",
  suffix = "",
  className = "",
  formatter,
}: CountUpProps) {
  const [display, setDisplay] = useState("0");
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fmt = formatter || defaultFormat;

  useEffect(() => {
    startRef.current = performance.now();

    function tick(now: number) {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const value = easeOut(progress) * end;
      setDisplay(fmt(Math.round(value)));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(fmt(end));
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, fmt]);

  return (
    <span className={`font-mono ${className}`}>
      {prefix}{display}{suffix}
    </span>
  );
}
