"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  TvMinimalIcon,
  LogOut,
  MailIcon,
  MailCheckIcon,
} from "lucide-react";
import { getOrCreateDeviceId } from "@/lib/device";

// Kill session button component
function KillSessionButton({
  code,
  onKillSession,
}: {
  code: string;
  onKillSession: () => void;
}) {
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    setIsHost(localStorage.getItem(`pp-host-${code}`) === "1");
  }, [code]);

  if (!isHost) return null;

  return (
    <Button
      size="sm"
      variant="destructive"
      onClick={onKillSession}
      className="text-xs px-2 py-1"
    >
      <Trash2 className="h-3 w-3" />
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
  const [codeFlashing, setCodeFlashing] = useState(false);
  const codeFlashTimer = useRef<number | null>(null);
  const [dark, setDark] = useState<boolean | null>(null);
  const [showDevices, setShowDevices] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [invite, setInvite] = useState(`/session/${code}`); // Start with relative URL
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [killConfirmCode, setKillConfirmCode] = useState("");
  const [killLoading, setKillLoading] = useState(false);
  const supabase = getSupabaseBrowserWithCode(code);

  useEffect(() => {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const stored = localStorage.getItem("pp-dark");
    const isDark = stored ? stored === "1" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);

    // Set the full invite URL after hydration
    setInvite(`${window.location.origin}/session/${code}`);
  }, [code]);

  // copy session code handler
  const copySessionCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      // trigger a short flash effect; reset any existing timer so multiple clicks re-trigger
      if (codeFlashTimer.current) {
        window.clearTimeout(codeFlashTimer.current);
      }
      setCodeFlashing(true);
      // hide flash after a short delay
      codeFlashTimer.current = window.setTimeout(() => {
        setCodeFlashing(false);
        codeFlashTimer.current = null;
      }, 350);
    } catch (e) {
      // ignore
    }
  };

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

  const handleKillSession = () => {
    setShowKillConfirm(true);
    setKillConfirmCode("");
  };

  const killSession = async () => {
    if (!supabase || killConfirmCode !== code) return;

    setKillLoading(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("code", code);
      if (error) throw error;
      localStorage.removeItem(`pp-host-${code}`);
      window.location.href = "/";
    } catch (e: any) {
      console.error("Kill session error:", e);
      alert("Failed to kill session: " + e.message);
    } finally {
      setKillLoading(false);
    }
  };

  // Leave session flow for the current device
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showHostLeaveDialog, setShowHostLeaveDialog] = useState(false);

  const handleLeaveClick = async () => {
    const deviceId = getOrCreateDeviceId();
    const isHost = localStorage.getItem(`pp-host-${code}`) === "1";

    if (!supabase) return;

    if (isHost) {
      // Check if there are other devices in the session
      try {
        const { count } = await supabase
          .from("devices")
          .select("*", { count: "exact", head: true })
          .eq("session_code", code)
          .neq("device_id", deviceId);

        if ((count || 0) > 0) {
          // Host cannot leave while others are connected without transferring
          setShowHostLeaveDialog(true);
          setShowDevices(true);
          return;
        }
      } catch (e) {
        // fall through to normal leave
      }
    }

    setShowLeaveConfirm(true);
  };

  const leaveSession = async () => {
    const deviceId = getOrCreateDeviceId();
    if (!supabase) return;
    setLeaveLoading(true);
    try {
      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", deviceId);

      if (error) throw error;

      localStorage.removeItem(`pp-host-${code}`);
      localStorage.removeItem(`pp-joined-${code}`);
      window.location.href = "/";
    } catch (e: any) {
      console.error("Leave session error:", e);
      alert("Failed to leave session: " + e.message);
      setLeaveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main header */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              PaperPaste
            </h1>
            <div
              className={`inline-flex items-center bg-primary/10 border border-primary/20 rounded px-1 py-0.2 cursor-pointer select-none transition-all duration-200 ${
                codeFlashing ? "ring-2 ring-green-400 scale-105" : ""
              }`}
              onClick={copySessionCode}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") copySessionCode();
              }}
              aria-label={`Copy session code ${code}`}
            >
              <span className="text-xs font-bold session-code text-primary tracking-tighter">
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
              <MailCheckIcon className="h-3 w-3" />
            ) : (
              <MailIcon className="h-3 w-3" />
            )}
            <span className="hidden sm:inline text-xs">
              {copied ? "Copied" : "Invite"}
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
            <TvMinimalIcon className="h-4 w-4" />
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveClick}
            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 font-medium"
            title="Leave session"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline text-xs">Leave</span>
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
          <CardContent className="text-center p-3 sm:p-6">
            <div className="flex flex-col items-center gap-2 sm:gap-3">
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
              <KillSessionButton
                code={code}
                onKillSession={handleKillSession}
              />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <DevicesPanel code={code} />
          </CardContent>
        </Card>
      )}

      {/* Kill Session Dialog */}
      <Dialog open={showKillConfirm} onOpenChange={setShowKillConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kill Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the session and all its data. All
              connected devices will be disconnected.
            </p>
            <p className="text-sm font-medium text-destructive">
              Type the session code{" "}
              <code className="bg-muted px-1 rounded">{code}</code> to confirm:
            </p>
            <Input
              value={killConfirmCode}
              onChange={(e) => setKillConfirmCode(e.target.value)}
              placeholder="Enter session code"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowKillConfirm(false);
                setKillConfirmCode("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={killSession}
              disabled={killConfirmCode !== code || killLoading}
            >
              {killLoading ? "Killing Session..." : "Kill Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Session Dialog */}
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to leave this session? You will be removed
              from the list of connected devices.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLeaveConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={leaveSession}>
              {leaveLoading ? "Leaving..." : "Leave Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Host cannot leave dialog */}
      <Dialog open={showHostLeaveDialog} onOpenChange={setShowHostLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Host Leaving</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You're the host and other devices are still connected. Transfer
              host privileges to another device before leaving, or remove all
              other devices.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowHostLeaveDialog(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setShowHostLeaveDialog(false);
                setShowDevices(true);
              }}
            >
              Manage Devices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
