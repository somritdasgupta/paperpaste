"use client";

import React from "react";
import { Shield, EyeOff } from "lucide-react";

type Variant = "frozen" | "hidden";

export default function MaskedOverlay({
  variant,
  className = "",
}: {
  variant: Variant;
  className?: string;
}) {
  const title = variant === "frozen" ? "Clipboard frozen" : "View hidden";
  const description =
    variant === "frozen"
      ? "Your editor is read-only — the host has frozen clipboard input."
      : "Your view has been hidden by the host — you cannot view or share content.";

  const Icon = variant === "frozen" ? Shield : EyeOff;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center ${className}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-md z-50"
        aria-hidden="true"
      />

      {/* Centered card */}
      <div className="relative z-60 max-w-md w-[min(92%,560px)] mx-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg rounded-2xl p-6 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-muted/20 dark:bg-muted/30 flex items-center justify-center">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-sm font-semibold mb-1">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
    </div>
  );
}
