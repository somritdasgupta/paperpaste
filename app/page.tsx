"use client";
import JoinForm from "@/components/session/join-form";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnifiedBottomSheet } from "@/components/session/unified-bottom-sheet";
import { QRScanner } from "@/components/qr-scanner";
import Footer from "@/components/ui/footer";
import { getStoredSession } from "@/lib/session-storage";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function EnvBanner() {
  const hasPublicUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ready = hasPublicUrl && hasAnon;

  if (ready) return null;
  return (
    <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-50 text-yellow-900 p-4 dark:bg-yellow-900/20 dark:text-yellow-100">
      <p className="font-semibold">Supabase setup needed</p>
      <ul className="list-disc ml-5 text-sm mt-2">
        <li>
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
          Project Settings → Environment Variables.
        </li>
        <li>
          Run the SQL script in supabase/migrations/paperpaste.sql to create
          tables and storage bucket. Safe to run on both new and existing
          databases.
        </li>
      </ul>
    </div>
  );
}

interface JoinFormProps {
  prefilledCode?: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scanOpen, setScanOpen] = useState(false);
  const [prefilledCode, setPrefilledCode] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [resumeSession, setResumeSession] = useState<{ code: string; deviceId: string } | null>(null);

  // Auto-reconnect to last active session
  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredSession();
        
        if (!stored) {
          setCheckingSession(false);
          return;
        }

        const supabase = getSupabaseBrowserWithCode(stored.sessionCode);
        if (!supabase) {
          setCheckingSession(false);
          return;
        }
        
        // Check session exists
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("code")
          .eq("code", stored.sessionCode)
          .maybeSingle();

        if (sessionError) {
          console.error("[AUTO-RECONNECT] Session query error:", sessionError);
          const { clearStoredSession } = await import("@/lib/session-storage");
          clearStoredSession();
          setCheckingSession(false);
          return;
        }

        if (!session) {
          const { clearStoredSession } = await import("@/lib/session-storage");
          clearStoredSession();
          setCheckingSession(false);
          return;
        }

        // Check device exists
        const { data: device, error: deviceError } = await supabase
          .from("devices")
          .select("*")
          .eq("session_code", stored.sessionCode)
          .eq("device_id", stored.deviceId)
          .maybeSingle();

        if (deviceError) {
          console.error("[AUTO-RECONNECT] Device query error:", deviceError);
          const { clearStoredSession } = await import("@/lib/session-storage");
          clearStoredSession();
          setCheckingSession(false);
          return;
        }

        if (device) {
          setResumeSession({ code: stored.sessionCode, deviceId: stored.deviceId });
          setCheckingSession(false);
          return;
        }
        
        // Check if kicked - clear flag and show resume prompt (will trigger rejoin request)
        const wasKicked = localStorage.getItem(`pp-kicked-${stored.sessionCode}-${stored.deviceId}`) === "1";
        
        if (wasKicked) {
          setResumeSession({ code: stored.sessionCode, deviceId: stored.deviceId });
          setCheckingSession(false);
          return;
        }
        
        const { clearStoredSession } = await import("@/lib/session-storage");
        clearStoredSession();
      } catch (error) {
        console.error("[AUTO-RECONNECT] ERROR:", error);
      }
      setCheckingSession(false);
    })();
  }, [router]);

  useEffect(() => {
    const code = searchParams.get("code");
    const action = searchParams.get("action");

    if (code && action === "create") {
      setPrefilledCode(code);
    }
  }, [searchParams]);

  const handleQrDetected = (text: string) => {
    try {
      setScanOpen(false);
      // find 7-digit code in URL or plain text
      const m = text.match(/(\d{7})/);
      if (m) {
        router.push(`/session/${m[1]}`);
        return;
      }
      // if it's a full URL, navigate to it
      if (text.startsWith("http")) {
        try {
          const url = new URL(text);
          // prefer app-relative if it contains /session/<code>
          const pathMatch = url.pathname.match(/\/session\/(\d{7})/);
          if (pathMatch) {
            router.push(`/session/${pathMatch[1]}`);
          } else {
            window.location.href = text;
          }
        } catch {
          window.location.href = text;
        }
      }
    } catch (e) {
      // swallow errors and just close
    }
  };

  if (checkingSession) {
    return (
      <main className="relative min-h-screen w-full bg-linear-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Checking for active session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-linear-to-br from-background via-background to-muted/30 flex flex-col">
      {/* Background Graphics */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl"></div>

        {/* Grid pattern - fixed to viewport */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[4rem_4rem]"></div>

        {/* Abstract shapes */}
        <svg
          className="absolute top-10 right-20 w-32 h-32 text-primary/10 animate-spin-slow"
          style={{ animationDuration: "30s" }}
          viewBox="0 0 200 200"
        >
          <path fill="currentColor" d="M100,20 L180,180 L20,180 Z" />
        </svg>
        <svg
          className="absolute bottom-20 left-20 w-24 h-24 text-primary/10"
          viewBox="0 0 100 100"
        >
          <rect width="100" height="100" rx="20" fill="currentColor" />
        </svg>
        <svg
          className="absolute top-1/3 right-1/4 w-16 h-16 text-primary/10 animate-bounce"
          style={{ animationDuration: "3s" }}
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" r="50" fill="currentColor" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-8 lg:px-10 flex-1 flex items-center justify-center py-8 sm:py-12">
        <div className="w-full space-y-6 sm:space-y-10">
          {/* Header Section */}
          <div className="text-center space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="h-7 w-7 bg-primary rounded"></div>
              </div>
            </div>
            <h1 className="text-balance text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
              PaperPaste
            </h1>
            <p className="text-pretty text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto">
              Secure, real-time clipboard syncing across all your devices.
            </p>
          </div>

          {/* Form Section */}
          <div className="w-full">
            <EnvBanner />
            <Card className="p-6 sm:p-10 text-center border-2 hover:border-primary/20 transition-colors relative overflow-hidden animated-border-card">
              <CardContent className="space-y-8">
                <JoinForm prefilledCode={prefilledCode} />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto border-2 hover:border-primary/20 h-12 text-base"
                    onClick={() => setScanOpen(true)}
                  >
                    Scan QR to Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <QRScanner
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleQrDetected}
      />

      <UnifiedBottomSheet
        isOpen={!!resumeSession}
        onOpenChange={(open) => !open && setResumeSession(null)}
        title="Resume Last Session?"
        description="You have an active session that you can continue"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="destructive"
              size="lg"
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={() => {
                const { clearStoredSession } = require("@/lib/session-storage");
                clearStoredSession();
                setResumeSession(null);
              }}
            >
              No
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                const wasKicked = localStorage.getItem(`pp-kicked-${resumeSession?.code}-${resumeSession?.deviceId}`) === "1";
                if (wasKicked) {
                  router.push(`/session/${resumeSession?.code}`);
                } else {
                  router.push(`/session/${resumeSession?.code}?join=1`);
                }
              }}
            >
              Yes
            </Button>
          </div>
        }
      >
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold font-mono tracking-wider text-primary">{resumeSession?.code}</div>
        </div>
      </UnifiedBottomSheet>
      
      <Footer />
    </main>
  );
}
