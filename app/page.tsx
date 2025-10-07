"use client";
import JoinForm from "@/components/session/join-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRScanner } from "@/components/qr-scanner";

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

export default function HomePage() {
  const router = useRouter();
  const [scanOpen, setScanOpen] = useState(false);

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

  return (
    <main className="bg-gradient-to-br from-background via-background to-muted/30">
      <section className="w-full px-4 sm:px-6 lg:px-16 xl:px-24 pt-12 sm:pt-16 pb-8">
        <div className="w-full text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-2 rounded bg-primary/10 border border-primary/20">
              <div className="h-6 w-6 bg-primary rounded"></div>
            </div>
          </div>
          <h1 className="text-balance text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
            PaperPaste
          </h1>
          <p className="mt-2 text-pretty text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Secure, real-time clipboard syncing across all your devices.
          </p>
        </div>
      </section>

      <section className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-8">
        <div className="w-full mx-auto">
          <EnvBanner />
          <div className="grid lg:grid-cols-1 gap-8">
            <Card className="p-8 sm:p-12 lg:p-16 text-center border-2 hover:border-primary/20 transition-colors">
              <CardContent className="space-y-8">
                <JoinForm />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto border-2 hover:border-primary/20"
                    onClick={() => setScanOpen(true)}
                  >
                    Scan QR to Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <QRScanner
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleQrDetected}
      />
    </main>
  );
}
