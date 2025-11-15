"use client";

import { Suspense, useState } from "react";
import SessionHeader from "@/components/session/session-header";
import ClipboardInput from "@/components/session/clipboard-input";
import ItemsList from "@/components/session/items-list";
import PairingScreen from "@/components/session/pairing-screen";
import { HistoryControlsProvider } from "@/components/session/history-controls-context";
import { useSearchParams } from "next/navigation";

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
      <main className="relative flex flex-col h-screen w-full bg-background overflow-hidden">
        {/* Subtle Grid Background Only */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-30">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-size-[4rem_4rem]"></div>
        </div>

        {/* Compact Header - Fixed */}
        <div className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 py-2 sm:py-3 bg-card/80 backdrop-blur-md">
          <div className="mx-auto w-full">
            <SessionHeader code={code} />
          </div>
        </div>

        {/* History section - Takes full height with top padding for fixed header and bottom padding for input */}
        <section className="relative z-10 flex-1 overflow-visible pt-16 pb-20">
          <Suspense
            fallback={
              <div className="p-4 text-sm text-muted-foreground animate-pulse">
                Loading history…
              </div>
            }
          >
            <ItemsList code={code} />
          </Suspense>
        </section>

        {/* Input section - Fixed at bottom (handled by ClipboardInput component) */}
        <ClipboardInput code={code} />
      </main>
    </HistoryControlsProvider>
  );
}
