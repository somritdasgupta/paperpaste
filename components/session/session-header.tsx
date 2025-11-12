"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { getOrCreateDeviceId } from "@/lib/device";
import { EyeOff, Shield } from "lucide-react";
import LeavingCountdown from "./leaving-countdown";
import { ErrorDialog } from "@/components/ui/error-dialog";

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
      className="text-xs px-3 py-1.5 gap-1.5 h-auto"
      title="Purge Session"
    >
      <Trash2 className="h-3.5 w-3.5" />
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
      .channel(`device-count-${code}-${Math.random()}`) // Add randomness for unique channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        () => {
          // Delay to ensure DB is updated
          setTimeout(() => fetchCount(), 100);
        }
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

function PermissionBadge({ code }: { code: string }) {
  const supabase = getSupabaseBrowserWithCode(code);
  const [state, setState] = useState<"normal" | "frozen" | "hidden">("normal");

  useEffect(() => {
    const deviceId = getOrCreateDeviceId();
    if (!supabase || !deviceId) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("devices")
        .select("is_frozen, can_view")
        .eq("device_id", deviceId)
        .eq("session_code", code)
        .single();
      if (data) {
        if (data.can_view === false) setState("hidden");
        else if (data.is_frozen) setState("frozen");
        else setState("normal");
      }
    };

    fetch();

    const channel = supabase
      .channel(`device-permissions-header-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          if (payload.new) {
            if (payload.new.can_view === false) setState("hidden");
            else if (payload.new.is_frozen) setState("frozen");
            else setState("normal");
          }
        }
      )
      // Listen for realtime broadcast events for instant permission changes
      .on("broadcast", { event: "permission_changed" }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          if (payload.payload.can_view === false) setState("hidden");
          else if (payload.payload.is_frozen) setState("frozen");
          else setState("normal");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, code]);

  if (state === "normal") return null;

  return (
    <div className="ml-2">
      <div
        className={`text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-2 shadow-lg border-2 transition-all duration-300 animate-pulse ${
          state === "frozen"
            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-300 shadow-orange-500/50"
            : "bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-300 shadow-red-500/50"
        }`}
        style={{ animationDuration: "2s" }}
      >
        {state === "frozen" ? (
          <Shield className="h-3.5 w-3.5" strokeWidth={2.5} />
        ) : (
          <EyeOff className="h-3.5 w-3.5" strokeWidth={2.5} />
        )}
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {state === "frozen" ? "Frozen" : "Hidden"}
        </span>
      </div>
    </div>
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
  const [showMobileCode, setShowMobileCode] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveReason, setLeaveReason] = useState<
    "kicked" | "left" | "host-left"
  >("left");
  const [exportEnabled, setExportEnabled] = useState(true);
  const [deletionEnabled, setDeletionEnabled] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });
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

    // Check if user is host
    setIsHost(localStorage.getItem(`pp-host-${code}`) === "1");

    // Fetch session settings
    if (supabase) {
      supabase
        .from("sessions")
        .select("export_enabled, allow_item_deletion")
        .eq("code", code)
        .single()
        .then(({ data, error }) => {
          if (data) {
            setExportEnabled(data.export_enabled !== false);
            // Default to true if column doesn't exist yet
            setDeletionEnabled(data.allow_item_deletion !== false);
          } else if (error) {
            // Column might not exist yet, default to true
            console.warn("Could not fetch session settings:", error);
            setDeletionEnabled(true);
          }
        });
    }
  }, [code, supabase]);

  // Auto-hide mobile code after 5 seconds
  useEffect(() => {
    if (showMobileCode) {
      const timer = setTimeout(() => {
        setShowMobileCode(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showMobileCode]);

  // copy session code handler
  const copySessionCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      if (codeFlashTimer.current) {
        window.clearTimeout(codeFlashTimer.current);
      }
      setCodeFlashing(true);
      codeFlashTimer.current = window.setTimeout(() => {
        setCodeFlashing(false);
        codeFlashTimer.current = null;
      }, 350);
    } catch (e) {
      // ignore
    }
  };

  // Mobile code chevron click - shows code and auto-copies
  const handleMobileCodeToggle = async () => {
    if (!showMobileCode) {
      // Show code and copy to clipboard
      setShowMobileCode(true);
      try {
        await navigator.clipboard.writeText(code);
        setCodeFlashing(true);
        if (codeFlashTimer.current) {
          window.clearTimeout(codeFlashTimer.current);
        }
        codeFlashTimer.current = window.setTimeout(() => {
          setCodeFlashing(false);
          codeFlashTimer.current = null;
        }, 800);
      } catch (e) {
        // ignore
      }
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
      setErrorDialog({
        open: true,
        title: "Kill Session Failed",
        message: e.message || "Failed to kill session",
      });
    } finally {
      setKillLoading(false);
    }
  };

  // Toggle global export for entire session
  const toggleGlobalExport = async () => {
    if (!supabase || !isHost) return;

    try {
      const newStatus = !exportEnabled;
      const { error } = await supabase
        .from("sessions")
        .update({ export_enabled: newStatus })
        .eq("code", code);

      if (error) throw error;
      setExportEnabled(newStatus);
    } catch (e: any) {
      console.error("Toggle export error:", e);
      setErrorDialog({
        open: true,
        title: "Toggle Export Failed",
        message: e.message || "Failed to toggle export",
      });
    }
  };

  // Toggle item deletion for entire session
  const toggleItemDeletion = async () => {
    if (!supabase || !isHost) return;

    try {
      const newStatus = !deletionEnabled;
      const { error } = await supabase
        .from("sessions")
        .update({ allow_item_deletion: newStatus })
        .eq("code", code);

      if (error) {
        // Column might not exist yet
        if (error.message?.includes("allow_item_deletion")) {
          setErrorDialog({
            open: true,
            title: "Migration Required",
            message:
              "Deletion control feature requires database migration. Please apply the migration first:\nsupabase db push",
          });
          return;
        }
        throw error;
      }
      setDeletionEnabled(newStatus);
    } catch (e: any) {
      console.error("Toggle deletion error:", e);
      setErrorDialog({
        open: true,
        title: "Toggle Deletion Failed",
        message: e.message || "Failed to toggle deletion",
      });
    }
  };

  // Leave session flow for the current device
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showHostLeaveDialog, setShowHostLeaveDialog] = useState(false);
  const [deleteMyData, setDeleteMyData] = useState(false);
  const [myItemsCount, setMyItemsCount] = useState(0);

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

    // Count user's items before showing dialog
    try {
      const { count } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("session_code", code)
        .eq("device_id", deviceId);

      setMyItemsCount(count || 0);
    } catch (e) {
      console.error("Count items error:", e);
    }

    setShowLeaveConfirm(true);
  };

  const leaveSession = async () => {
    const deviceId = getOrCreateDeviceId();
    if (!supabase) return;
    setLeaveLoading(true);
    try {
      // Delete user's items if checkbox is checked
      if (deleteMyData && myItemsCount > 0) {
        const { error: itemsError } = await supabase
          .from("items")
          .delete()
          .eq("session_code", code)
          .eq("device_id", deviceId);

        if (itemsError) {
          console.error("Delete items error:", itemsError);
          // Don't throw, continue with device deletion
        }
      }

      // Delete device record
      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", deviceId);

      if (error) throw error;

      localStorage.removeItem(`pp-host-${code}`);
      localStorage.removeItem(`pp-joined-${code}`);
      setShowLeaveConfirm(false);
      setLeaveReason("left");
      setIsLeaving(true);
    } catch (e: any) {
      console.error("Leave session error:", e);
      setErrorDialog({
        open: true,
        title: "Leave Session Failed",
        message: e.message || "Failed to leave session",
      });
      setLeaveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main header */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {/* Show PaperPaste or Code based on mobile state */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight transition-all duration-300">
              {/* Mobile: Show PaperPaste or Code based on toggle state */}
              <span className={`sm:hidden ${showMobileCode ? "hidden" : ""}`}>
                PaperPaste
              </span>
              {showMobileCode && (
                <span
                  className={`sm:hidden text-primary font-mono animate-in fade-in zoom-in-95 duration-200 ${
                    codeFlashing ? "text-green-600" : ""
                  }`}
                >
                  {code}
                </span>
              )}
              {/* Desktop: Always show PaperPaste */}
              <span className="hidden sm:inline">PaperPaste</span>
            </h1>

            {/* Desktop Code Badge - Only visible on desktop */}
            <div
              className={`hidden sm:inline-flex items-center bg-primary/10 border border-primary/20 rounded px-1 py-0.2 cursor-pointer select-none transition-all duration-200 ${
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

            <button
              onClick={handleMobileCodeToggle}
              className={`sm:hidden flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-all duration-200 ${
                showMobileCode ? "bg-green-500/20" : ""
              }`}
              aria-label="Show and copy session code"
            >
              {codeFlashing ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 relative">
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
          <PermissionBadge code={code} />
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Devices</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {isHost && (
                  <>
                    {/* Export Toggle Switch */}
                    <button
                      onClick={toggleGlobalExport}
                      className={`relative inline-flex h-7 w-[90px] items-center justify-between rounded-full px-1 transition-colors cursor-pointer ${
                        exportEnabled ? "bg-primary" : "bg-muted"
                      }`}
                      title="Allow all users to export session history"
                    >
                      <span
                        className={`text-[10px] font-medium transition-opacity ${
                          exportEnabled
                            ? "opacity-100 text-primary-foreground ml-2"
                            : "opacity-0"
                        }`}
                      >
                        Export
                      </span>
                      <span
                        className={`absolute left-1 inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform ${
                          exportEnabled ? "translate-x-[62px]" : "translate-x-0"
                        }`}
                      />
                      <span
                        className={`text-[10px] font-medium transition-opacity ${
                          !exportEnabled
                            ? "opacity-100 text-muted-foreground mr-2"
                            : "opacity-0"
                        }`}
                      >
                        Export
                      </span>
                    </button>

                    {/* Deletion Toggle Switch */}
                    <button
                      onClick={toggleItemDeletion}
                      className={`relative inline-flex h-7 w-[90px] items-center justify-between rounded-full px-1 transition-colors cursor-pointer ${
                        deletionEnabled ? "bg-primary" : "bg-muted"
                      }`}
                      title="Allow users to delete items from history"
                    >
                      <span
                        className={`text-[10px] font-medium transition-opacity ${
                          deletionEnabled
                            ? "opacity-100 text-primary-foreground ml-2"
                            : "opacity-0"
                        }`}
                      >
                        Delete
                      </span>
                      <span
                        className={`absolute left-1 inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform ${
                          deletionEnabled
                            ? "translate-x-[62px]"
                            : "translate-x-0"
                        }`}
                      />
                      <span
                        className={`text-[10px] font-medium transition-opacity ${
                          !deletionEnabled
                            ? "opacity-100 text-muted-foreground mr-2"
                            : "opacity-0"
                        }`}
                      >
                        Delete
                      </span>
                    </button>
                  </>
                )}
                <KillSessionButton
                  code={code}
                  onKillSession={handleKillSession}
                />
              </div>
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
      <Dialog
        open={showLeaveConfirm}
        onOpenChange={(open) => {
          setShowLeaveConfirm(open);
          if (!open) {
            setDeleteMyData(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Session</DialogTitle>
            <DialogDescription>
              Choose how you want to leave this session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You will be removed from the list of connected devices.
            </p>

            {myItemsCount > 0 && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="delete-data"
                    checked={deleteMyData}
                    onCheckedChange={(checked) =>
                      setDeleteMyData(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor="delete-data"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Delete my contributions
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Remove all {myItemsCount} item
                      {myItemsCount !== 1 ? "s" : ""} you added to this session
                    </p>
                  </div>
                </div>
                {deleteMyData && (
                  <div className="pl-7 animate-in slide-in-from-top-2">
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-destructive"></span>
                      This action cannot be undone
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowLeaveConfirm(false);
                setDeleteMyData(false);
              }}
              disabled={leaveLoading}
            >
              Cancel
            </Button>
            <Button
              variant={deleteMyData ? "destructive" : "default"}
              onClick={leaveSession}
              disabled={leaveLoading}
            >
              {leaveLoading
                ? "Leaving..."
                : deleteMyData
                ? "Leave & Delete Data"
                : "Leave Session"}
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

      {/* Leaving countdown overlay */}
      {isLeaving && <LeavingCountdown reason={leaveReason} />}

      {/* Error Dialog */}
      <ErrorDialog
        open={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, title: "", message: "" })}
        title={errorDialog.title}
        message={errorDialog.message}
      />
    </div>
  );
}
