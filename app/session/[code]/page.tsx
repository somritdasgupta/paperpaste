"use client";

import { Suspense, useState } from "react";
import SessionHeader from "@/components/session/session-header";
import ClipboardInput from "@/components/session/clipboard-input";
import ItemsList from "@/components/session/items-list";
import PairingScreen from "@/components/session/pairing-screen";
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
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
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
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
    <main className="flex flex-col h-screen w-full bg-background overflow-hidden">
      {/* Compact Header */}
      <div className="flex-none px-3 sm:px-4 py-2 sm:py-3 border-b bg-card/50 backdrop-blur-sm">
        <div className="mx-auto w-full">
          <SessionHeader code={code} />
        </div>
      </div>

      {/* Main content area - FLIPPED LAYOUT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* History section - NOW ON TOP (takes up remaining space) */}
        <section className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto min-h-0">
            <Suspense
              fallback={
                <div className="p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground animate-pulse">
                  Loading history…
                </div>
              }
            >
              <ItemsList code={code} />
            </Suspense>
          </div>
        </section>

        {/* Input section - NOW AT BOTTOM (sticky, WhatsApp-style) */}
        <section className="flex-none border-t bg-card shadow-lg">
          <div className="px-2 sm:px-4 py-1.5 sm:py-3">
            <ClipboardInput code={code} />
          </div>
        </section>
      </div>
    </main>
  );
}
