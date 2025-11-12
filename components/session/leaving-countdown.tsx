"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Timer } from "lucide-react";

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 min-h-screen">
      <div className="relative max-w-md w-full">
        <div className="relative bg-card backdrop-blur-xl border-2 border-border shadow-2xl rounded-2xl p-6 sm:p-8 text-center overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 blur-xl"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary"></div>

          <div className="relative z-10">
            <div className="mx-auto mb-4 sm:mb-6 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg">
              <LogOut
                className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground"
                strokeWidth={2.5}
              />
            </div>

            <h3 className="text-xl sm:text-2xl font-bold mb-3 text-foreground">
              {messages[reason]}
            </h3>

            <div className="my-6 sm:my-8">
              <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30 animate-pulse">
                <span className="text-4xl sm:text-5xl font-bold text-primary-foreground">
                  {countdown}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Returning to home screen...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
