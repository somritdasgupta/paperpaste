"use client";
import { useEffect, useRef } from "react";
import { triggerGlobalRefresh } from "@/lib/globalRefresh";

export default function GlobalRefresh({
  interval = 3000,
}: {
  interval?: number;
}) {
  const timeoutRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const schedule = async () => {
      if (cancelledRef.current) return;
      try {
        triggerGlobalRefresh();
      } catch (e) {
        console.error("Global refresh trigger failed", e);
      }
      const jitter = Math.floor(Math.random() * 800);
      const delay = Math.max(500, interval + jitter - 400);
      timeoutRef.current = window.setTimeout(
        schedule,
        delay
      ) as unknown as number;
    };

    // Slight initial stagger
    timeoutRef.current = window.setTimeout(
      schedule,
      Math.floor(Math.random() * 600)
    ) as unknown as number;

    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current as number);
    };
  }, [interval]);

  return null;
}
