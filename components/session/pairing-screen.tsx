"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId, getDeviceInfo, heartbeat } from "@/lib/device";
import { useRouter } from "next/navigation";

export default function PairingScreen({
  code,
  isNew,
}: {
  code: string;
  isNew: boolean;
}) {
  const supabase = getSupabaseBrowserWithCode(code);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const invite = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/session/${code}`;
  }, [code]);

  // Create session for host if new, and flag host locally
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        deviceIdRef.current = getOrCreateDeviceId();
        if (isNew) {
          localStorage.setItem(`pp-host-${code}`, "1");
          // upsert session row if not exists
          await supabase.from("sessions").upsert({ code }).select().single();
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to initialize session.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, code, isNew]);

  const getIn = async () => {
    if (!supabase) {
      alert("Supabase not configured. Add environment variables first.");
      return;
    }
    try {
      setBusy(true);
      const deviceInfo = getDeviceInfo();
      const deviceId = deviceIdRef.current || deviceInfo.id;
      const isHost = localStorage.getItem(`pp-host-${code}`) === "1";

      // Encrypt device name for privacy
      const sessionKey = await import("@/lib/encryption").then((m) =>
        m.generateSessionKey(code)
      );
      const encryptedDeviceName = await import("@/lib/encryption").then((m) =>
        m.encryptDeviceName(deviceInfo.name, sessionKey)
      );

      // register device presence (idempotent)
      await supabase
        .from("devices")
        .upsert({
          session_code: code,
          device_id: deviceId,
          device_name_encrypted: encryptedDeviceName,
          is_host: isHost as any,
        })
        .select()
        .single();
      // start heartbeat
      heartbeat(supabase, code, deviceId);
      // enter session view
      router.replace(`/session/${code}?join=1`);
    } catch (e: any) {
      setError(e?.message || "Failed to join session.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-card p-6 sm:p-8 lg:p-12 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">
          Join Session {code}
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Pair this device to sync clipboard data in real-time.
        </p>

        <div className="mt-8 flex flex-col items-center gap-6">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
              invite
            )}`}
            alt="Session QR"
            width={200}
            height={200}
            className="rounded-lg border shadow-sm"
          />
          <p className="text-sm text-muted-foreground break-all px-4 max-w-md">
            {invite}
          </p>
        </div>

        <div className="mt-10">
          <Button
            size="lg"
            onClick={getIn}
            disabled={busy}
            className="w-full sm:w-auto px-8 py-3 text-lg"
          >
            {busy ? "Getting in…" : "Get in"}
          </Button>
        </div>

        {error && (
          <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
