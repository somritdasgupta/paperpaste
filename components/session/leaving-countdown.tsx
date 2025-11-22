"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LeavingCountdown({
  reason,
}: {
  reason: "kicked" | "left" | "host-left";
}) {
  const [countdown, setCountdown] = useState(3);
  const router = useRouter();
  const elRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (countdown === 0) {
      router.push("/");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router]);

  const messages = {
    kicked: "You have been removed from the session",
    left: "You left the session",
    "host-left": "The host has ended the session",
  };

  // Create portal root on mount so this overlay is appended to document.body
  useEffect(() => {
    if (typeof document === "undefined") return;
    elRef.current = document.createElement("div");
    // optional id for easier debugging
    elRef.current.id = "pp-leaving-countdown-portal";
    document.body.appendChild(elRef.current);
    setMounted(true);
    return () => {
      if (elRef.current && document.body.contains(elRef.current)) {
        document.body.removeChild(elRef.current);
      }
      elRef.current = null;
    };
  }, []);

  const content = (
    <div
      // extremely high z-index and pointer-events to ensure this sits above everything
      className="fixed inset-0 flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-in fade-in duration-200 min-h-screen pointer-events-auto"
      style={{ zIndex: 2147483647 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          {/* Icon */}
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <LogOut className="h-6 w-6 text-primary" strokeWidth={2} />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {messages[reason]}
            </h3>
            <p className="text-sm text-muted-foreground">
              Redirecting in {countdown}s
            </p>
          </div>

          {/* Countdown indicator */}
          <div className="flex justify-center">
            <div className="w-full max-w-[200px] h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${((3 - countdown) / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return mounted && elRef.current ? createPortal(content, elRef.current) : null;
}
