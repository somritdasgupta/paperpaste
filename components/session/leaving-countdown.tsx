"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LeavingCountdown({
  reason,
}: {
  reason: "kicked" | "left" | "host-left";
}) {
  const [countdown, setCountdown] = useState(3);
  const router = useRouter();

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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background backdrop-blur-md animate-in fade-in duration-200 min-h-screen">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-lg p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
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
}
