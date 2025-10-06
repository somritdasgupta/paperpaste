"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DevicesPanel from "./devices-panel";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";

// Device count badge component
function DeviceCountBadge({ code }: { code: string }) {
  const [count, setCount] = useState(0);
  const supabase = getSupabaseBrowserWithCode(code);

  useEffect(() => {
    if (!supabase) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("session_code", code);
      setCount(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel(`device-count-${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, code]);

  if (count <= 1) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
      {count}
    </span>
  );
}

export default function SessionHeader({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [dark, setDark] = useState<boolean | null>(null);
  const [showDevices, setShowDevices] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const stored = localStorage.getItem("pp-dark");
    const isDark = stored ? stored === "1" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
  }, []);

  const invite = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/session/${code}`;
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const toggleDark = () => {
    if (dark === null) return;
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pp-dark", next ? "1" : "0");
    setDark(next);
  };

  return (
    <div className="space-y-4">
      {/* Main header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">
            Session {code}
          </h1>
          <p className="text-sm text-muted-foreground">
            Share this link or QR to join from another device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? "Copied!" : "Copy Invite"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowQR((s) => !s)}
          >
            {showQR ? "Hide QR" : "Show QR"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDevices((s) => !s)}
            className="relative"
          >
            {showDevices ? "Hide Devices" : "Show Devices"}
            <DeviceCountBadge code={code} />
          </Button>
          <Button variant="default" size="sm" onClick={toggleDark}>
            {dark ? "Light" : "Dark"}
          </Button>
        </div>
      </header>

      {/* QR Code Card */}
      {showQR && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-center">
              Scan to Join Session
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col items-center gap-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  invite
                )}`}
                alt="Session QR"
                width={160}
                height={160}
                className="rounded border"
              />
              <p className="text-xs text-muted-foreground break-all max-w-md">
                {invite}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices Card */}
      {/* Integrated Devices Panel */}
      {showDevices && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Connected Devices
              <DeviceCountBadge code={code} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DevicesPanel code={code} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
