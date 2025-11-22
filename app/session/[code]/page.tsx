"use client";

import { Suspense, useState } from "react";
import SessionHeader from "@/components/session/session-header";
import ClipboardInput from "@/components/session/clipboard-input";
import ItemsList from "@/components/session/items-list";
import PairingScreen from "@/components/session/pairing-screen";
import { HistoryControlsProvider } from "@/components/session/history-controls-context";
import { useSearchParams } from "next/navigation";
import SessionBottomSheet from "@/components/session/session-bottom-sheet";

type Props = {
  params: Promise<{ code: string }>;
};

export default function SessionPage({ params }: Props) {
  const [code, setCode] = useState<string>("");
  const searchParams = useSearchParams();
  const joined = searchParams?.get("join") === "1";
  const isNew = searchParams?.get("new") === "1";

  // Unwrap params
  params.then((p) => setCode(p.code));

  // Don't render until we have the code
  if (!code) {
    return null;
  }

  // Basic session code format validation
  if (code.length !== 7 || !/^[A-Z0-9]{7}$/.test(code)) {
    return (
      <div className="min-h-screen bg-linear-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">
              Invalid Session Code
            </h1>
            <p className="text-muted-foreground">
              The session code format is invalid.
            </p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!joined) {
    return <PairingScreen code={code} isNew={isNew} />;
  }

  return (
    <HistoryControlsProvider sessionCode={code}>
      <main className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e120_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e120_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
        </div>

        {/* Compact Header */}
        <div className="shrink-0 z-50 px-4 sm:px-6 py-3 sm:py-4 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-800/50 shadow-sm">
          <div className="mx-auto w-full">
            <SessionHeader code={code} />
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 z-10 overflow-hidden">
          <Suspense
            fallback={
              <div className="p-4 text-sm text-muted-foreground animate-pulse">
                Loading history…
              </div>
            }
          >
            <ItemsList code={code} />
          </Suspense>
        </div>

        {/* Input section */}
        <ClipboardInput code={code} />

        {/* Global Bottom Sheet */}
        <SessionBottomSheet />
      </main>
    </HistoryControlsProvider>
  );
}
