"use client";

import React from "react";
import { Shield, EyeOff, Lock } from "lucide-react";

type Variant = "frozen" | "hidden";

export default function MaskedOverlay({
  variant,
  className = "",
}: {
  variant: Variant;
  className?: string;
}) {
  const title = variant === "frozen" ? "🔒 History Frozen" : "🚫 View Hidden";
  const description =
    variant === "frozen"
      ? "The host has frozen the history. You can still write and send items, but cannot see shared content."
      : "The host has hidden your view. You have NO ACCESS - you cannot view or share any content.";

  const Icon = variant === "frozen" ? Shield : EyeOff;

  // For frozen, use absolute positioning (only covers items list)
  // For hidden, use fixed positioning (covers entire screen)
  const positionClass = variant === "frozen" ? "absolute" : "fixed";

  return (
    <div
      className={`${positionClass} inset-0 z-[9999] flex items-center justify-center p-4 ${className}`}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-900/98 via-slate-800/98 to-slate-900/98 dark:from-black/98 dark:via-slate-950/98 dark:to-black/98 backdrop-blur-2xl"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(74, 86, 226, 0.15), transparent 50%)",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <Lock
          className="w-64 h-64 text-white animate-pulse"
          style={{ animationDuration: "3s" }}
        />
      </div>
      <div className="relative max-w-md w-full">
        <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 border-slate-200/50 dark:border-slate-700/50 shadow-2xl rounded-3xl p-8 text-center overflow-hidden">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl -z-10"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
          <div
            className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/50 dark:shadow-blue-500/30 animate-pulse"
            style={{ animationDuration: "2s" }}
          >
            <Icon className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            {title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            {description}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-full">
            <div
              className={`w-2 h-2 rounded-full ${
                variant === "frozen" ? "bg-orange-500" : "bg-red-500"
              } animate-pulse`}
            ></div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              {variant === "frozen" ? "Read-Only Mode" : "Access Restricted"}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50/50 dark:from-slate-800/30 to-transparent pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
