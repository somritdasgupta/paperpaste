import { Suspense } from "react";
import SessionHeader from "@/components/session/session-header";
import ClipboardInput from "@/components/session/clipboard-input";
import ItemsList from "@/components/session/items-list";
import PairingScreen from "@/components/session/pairing-screen";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

export default async function SessionPage({ params, searchParams }: Props) {
  const { code } = await params;
  const searchParamsResolved = await searchParams;
  const joined = searchParamsResolved?.join === "1";
  const isNew = searchParamsResolved?.new === "1";

  // Basic session code format validation
  if (!code || code.length !== 7 || !/^[A-Z0-9]{7}$/.test(code)) {
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
    <main className="flex flex-col min-h-screen w-full bg-background">
      {/* Header with better mobile spacing */}
      <div className="flex-none px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-6 border-b">
        <div className="mx-auto w-full">
          <SessionHeader code={code} />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-6 gap-3 sm:gap-4 lg:gap-6">
        <div className="mx-auto w-full flex-1 flex flex-col gap-3 sm:gap-4 lg:gap-6">
          {/* Input section */}
          <section className="flex-none rounded-lg sm:rounded-xl border bg-card p-3 sm:p-4 lg:p-6 shadow-sm">
            <ClipboardInput code={code} />
          </section>

          {/* Items section with better mobile layout */}
          <section className="flex-1 rounded-lg sm:rounded-xl border bg-card overflow-hidden flex flex-col shadow-sm min-h-0">
            <div className="flex-none p-3 sm:p-4 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground">
                Shared Items
              </h3>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                  title="Real-time sync active"
                ></div>
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <Suspense
                fallback={
                  <div className="p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground animate-pulse">
                    Loading items…
                  </div>
                }
              >
                <ItemsList code={code} />
              </Suspense>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
