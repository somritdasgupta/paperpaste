"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DevicesPanel from "./devices-panel";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import {
  Share2,
  QrCode,
  Copy,
  Check,
  Sun,
  Moon,
  Users,
  ExternalLink,
  Trash2,
  Timer,
} from "lucide-react";

// Kill session button component
function KillSessionButton({ code }: { code: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowserWithCode(code);
  const isHost =
    typeof window !== "undefined" &&
    localStorage.getItem(`pp-host-${code}`) === "1";

  const killSession = async () => {
    if (
      !supabase ||
      !confirm(
        `Are you sure you want to kill session ${code}? This will disconnect all devices.`
      )
    )
      return;

    setLoading(true);
    try {
      // Delete all items, devices, and session
      await supabase.from("items").delete().eq("session_code", code);
      await supabase.from("devices").delete().eq("session_code", code);
      await supabase.from("sessions").delete().eq("code", code);

      // Redirect to home
      window.location.href = "/";
    } catch (e: any) {
      console.error("Failed to kill session:", e);
      alert("Failed to kill session");
    } finally {
      setLoading(false);
    }
  };

  if (!isHost) return null;

  return (
    <Button
      size="sm"
      variant="destructive"
      onClick={killSession}
      disabled={loading}
      className="text-xs px-2 py-1"
    >
      {loading ? (
        <Timer className="h-3 w-3 animate-spin" />
      ) : (
        <Trash2 className="h-3 w-3" />
      )}
    </Button>
  );
}

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
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              PaperPaste
            </h1>
            <div className="inline-flex items-center bg-primary/10 border border-primary/20 rounded-md px-1.5 py-0.5">
              <span className="text-xs font-bold session-code text-primary tracking-wide">
                {code}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant={copied ? "default" : "outline"}
            size="sm"
            onClick={copy}
            className={`gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 font-medium transition-all duration-300 ${
              copied
                ? "bg-green-600 hover:bg-green-700 text-white border-green-600 scale-105"
                : ""
            }`}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="hidden sm:inline text-xs">
              {copied ? "Copied" : "Copy"}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQR((s) => !s)}
            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 font-medium"
          >
            <QrCode className="h-3 w-3" />
            <span className="hidden sm:inline text-xs">QR</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDevices((s) => !s)}
            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 font-medium relative"
          >
            <Users className="h-3 w-3" />
            <span className="hidden sm:inline text-xs">Devices</span>
            <DeviceCountBadge code={code} />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={toggleDark}
            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 font-medium"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
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
      {showDevices && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Connected Devices</CardTitle>
              <KillSessionButton code={code} />
            </div>
          </CardHeader>
          <CardContent>
            <DevicesPanel code={code} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
