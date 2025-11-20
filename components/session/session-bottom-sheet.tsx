"use client";

import { useHistoryControls } from "./history-controls-context";
import { UnifiedBottomSheet } from "./unified-bottom-sheet";
import DevicesPanel from "./devices-panel";
import { VerificationContent } from "./verification-content";
import QRCodePanel from "./qr-code-panel";
import { Button } from "@/components/ui/button";
import { Trash2, LogOut, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";

export default function SessionBottomSheet() {
  const { bottomSheet, closeBottomSheet, sessionCode } = useHistoryControls();
  const { isOpen, view, data } = bottomSheet;

  // Helper to get title and description based on view
  const getContent = () => {
    switch (view) {
      case "devices":
        return {
          title: "Connected Devices",
          description: "Manage devices connected to this session.",
          content: <DevicesPanel code={sessionCode} />,
        };
      case "qr":
        return {
          title: "Share Session",
          description:
            "Scan this QR code to join the session on another device.",
          content: <QRCodePanel code={sessionCode} />,
        };
      case "verification":
        return {
          title: "Session Verification",
          description: "Verify the integrity of your end-to-end encryption.",
          content: (
            <VerificationContent
              sessionKey={data?.sessionKey}
              sessionCode={sessionCode}
              isItemVerification={data?.isItemVerification}
              itemType={data?.itemType}
            />
          ),
        };
      case "delete-item":
        return {
          title: "Delete Item",
          description:
            "Are you sure you want to delete this item? This action cannot be undone.",
          content: (
            <DeleteItemConfirm
              itemId={data?.itemId}
              sessionCode={sessionCode}
              onClose={closeBottomSheet}
            />
          ),
        };
      case "leave-session":
        return {
          title: "Leave Session",
          description: "Are you sure you want to leave this session?",
          content: (
            <LeaveSessionConfirm
              data={data}
              sessionCode={sessionCode}
              onClose={closeBottomSheet}
            />
          ),
        };
      case "kill-session":
        return {
          title: "Purge Session",
          description:
            "This will permanently delete all data and disconnect all devices.",
          content: (
            <KillSessionConfirm
              sessionCode={sessionCode}
              onClose={closeBottomSheet}
            />
          ),
        };
      default:
        return { title: "", description: "", content: null };
    }
  };

  const { title, description, content } = getContent();

  return (
    <UnifiedBottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => !open && closeBottomSheet()}
      title={title}
      description={description}
    >
      {content}
    </UnifiedBottomSheet>
  );
}

// Sub-components for confirmations

function DeleteItemConfirm({
  itemId,
  sessionCode,
  onClose,
}: {
  itemId: string;
  sessionCode: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserWithCode(sessionCode);
    if (supabase) {
      await supabase.from("items").delete().eq("id", itemId);
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex justify-center pt-2">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Deleting..." : "Delete Item"}
        </Button>
      </div>
    </div>
  );
}

function LeaveSessionConfirm({
  data,
  sessionCode,
  onClose,
}: {
  data: any;
  sessionCode: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [deleteMyData, setDeleteMyData] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [hasItems, setHasItems] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const { openBottomSheet } = useHistoryControls();

  useEffect(() => {
    const checkItems = async () => {
      const supabase = getSupabaseBrowserWithCode(sessionCode);
      const deviceId = getOrCreateDeviceId();
      if (supabase) {
        const { count } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("session_code", sessionCode)
          .eq("device_id", deviceId);
        setHasItems((count || 0) > 0);
      }
    };
    checkItems();
  }, [sessionCode]);

  const handleLeave = async () => {
    if (confirmCode !== sessionCode) return;
    setLoading(true);
    const supabase = getSupabaseBrowserWithCode(sessionCode);
    const deviceId = getOrCreateDeviceId();

    if (supabase) {
      if (deleteMyData) {
        await supabase
          .from("items")
          .delete()
          .eq("session_code", sessionCode)
          .eq("device_id", deviceId);
      }
      await supabase
        .from("devices")
        .delete()
        .eq("session_code", sessionCode)
        .eq("device_id", deviceId);

      localStorage.removeItem(`pp-host-${sessionCode}`);
      localStorage.removeItem(`pp-joined-${sessionCode}`);
      window.location.href = "/";
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      {data?.isHost && data?.otherDevicesCount > 0 ? (
        <div className="flex flex-col gap-4 p-4 bg-orange-500/10 text-orange-600 rounded-lg border border-orange-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="font-bold text-sm">Host Privileges</p>
          </div>
          <div className="text-sm space-y-2">
            <p>There are {data.otherDevicesCount} other devices connected.</p>
            <p>
              If you leave now, the session may be left without a host. To
              transfer privileges, please use the Devices panel.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border-orange-500/20"
              onClick={() => openBottomSheet("devices")}
            >
              Go to Devices Panel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-7 gap-2 max-w-sm mx-auto">
        {sessionCode.split("").map((char, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            placeholder={char}
            value={confirmCode[i] || ""}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().slice(0, 1);
              const newCode = confirmCode.split("");
              newCode[i] = val;
              setConfirmCode(newCode.join("").padEnd(7, "").slice(0, 7));
              if (val && i < 6) {
                const nextInput = e.target.parentElement?.children[i + 1] as HTMLInputElement;
                nextInput?.focus();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !confirmCode[i] && i > 0) {
                e.preventDefault();
                const prevInput = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement;
                prevInput?.focus();
              }
            }}
            className="h-12 text-xl text-center font-medium border-2 focus:border-primary rounded-sm transition-all duration-200 shadow-[0_0_15px_rgba(128,128,128,0.3)] focus:shadow-[0_0_20px_rgba(128,128,128,0.5)] bg-background placeholder:text-muted-foreground/60"
          />
        ))}
      </div>

      {/* Mobile Swipe to Leave */}
      <div className="block sm:hidden">
        <div
          ref={swipeContainerRef}
          className="relative bg-muted rounded-sm p-1 h-14 overflow-hidden select-none"
          style={{ touchAction: "pan-x" }}
        >
          <div
            className="absolute left-1 top-1 bottom-1 bg-destructive/20 rounded-sm transition-all duration-200 ease-out"
            style={{
              width: `${Math.max(0, (swipeX / (swipeContainerRef.current?.offsetWidth || 1)) * 100)}%`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-medium pointer-events-none text-sm">
            {loading ? "Leaving..." : isDragging ? (() => {
              const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
              const buttonWidth = 48;
              const maxSwipe = containerWidth - buttonWidth - 8;
              const threshold = maxSwipe * 0.7;
              return swipeX >= threshold ? "Release to leave!" : "Keep swiping...";
            })() : "Swipe to Leave"}
          </div>
          <div
            className="h-12 w-12 bg-destructive rounded-sm flex items-center justify-center shadow-lg touch-none transition-all duration-200 ease-out"
            style={{
              transform: `translateX(${swipeX}px)`,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onTouchStart={(e) => {
              if (loading || confirmCode !== sessionCode) return;
              const touch = e.touches[0];
              setStartX(touch.clientX);
              setIsDragging(true);
              setSwipeX(0);
            }}
            onTouchMove={(e) => {
              if (!isDragging || loading) return;
              e.preventDefault();
              const touch = e.touches[0];
              const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
              const buttonWidth = 48;
              const maxSwipe = containerWidth - buttonWidth - 8;
              const deltaX = Math.max(0, Math.min(maxSwipe, touch.clientX - startX));
              setSwipeX(deltaX);
            }}
            onTouchEnd={() => {
              if (!isDragging || loading) return;
              const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
              const buttonWidth = 48;
              const maxSwipe = containerWidth - buttonWidth - 8;
              const threshold = maxSwipe * 0.7;
              if (swipeX >= threshold) {
                if ("vibrate" in navigator) navigator.vibrate(50);
                setSwipeX(maxSwipe);
                setTimeout(() => handleLeave(), 150);
              } else {
                setSwipeX(0);
              }
              setIsDragging(false);
            }}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <LogOut className="h-5 w-5 text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Desktop Button */}
      <div className="hidden sm:flex justify-center pt-2">
        <Button
          variant="destructive"
          onClick={handleLeave}
          disabled={loading || confirmCode !== sessionCode}
          className="w-full"
        >
          {loading ? "Leaving..." : "Leave Session"}
        </Button>
      </div>

      {hasItems && (
        <button
          onClick={() => setDeleteMyData(!deleteMyData)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
            deleteMyData
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40"
          }`}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            deleteMyData
              ? "bg-red-500 border-red-500"
              : "border-muted-foreground/40"
          }`}>
            {deleteMyData && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium">
            Delete all items shared by this device
          </span>
        </button>
      )}
    </div>
  );
}

function KillSessionConfirm({
  sessionCode,
  onClose,
}: {
  sessionCode: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  const handleKill = async () => {
    if (confirmCode !== sessionCode) return;
    setLoading(true);
    const supabase = getSupabaseBrowserWithCode(sessionCode);
    if (supabase) {
      await supabase.from("sessions").delete().eq("code", sessionCode);
      localStorage.removeItem(`pp-host-${sessionCode}`);
      window.location.href = "/";
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid grid-cols-7 gap-2 max-w-sm mx-auto">
        {sessionCode.split("").map((char, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            placeholder={char}
            value={confirmCode[i] || ""}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().slice(0, 1);
              const newCode = confirmCode.split("");
              newCode[i] = val;
              setConfirmCode(newCode.join("").padEnd(7, "").slice(0, 7));
              if (val && i < 6) {
                const nextInput = e.target.parentElement?.children[i + 1] as HTMLInputElement;
                nextInput?.focus();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !confirmCode[i] && i > 0) {
                e.preventDefault();
                const prevInput = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement;
                prevInput?.focus();
              }
            }}
            className="h-12 text-xl text-center font-medium border-2 focus:border-primary rounded-sm transition-all duration-200 shadow-[0_0_15px_rgba(128,128,128,0.3)] focus:shadow-[0_0_20px_rgba(128,128,128,0.5)] bg-background placeholder:text-muted-foreground/60"
          />
        ))}
      </div>

      {/* Mobile Swipe to Purge */}
      <div className="block sm:hidden">
        <div
          ref={swipeContainerRef}
          className="relative bg-muted rounded-sm p-1 h-14 overflow-hidden select-none"
          style={{ touchAction: "pan-x" }}
        >
          <div
            className="absolute left-1 top-1 bottom-1 bg-destructive/20 rounded-sm transition-all duration-200 ease-out"
            style={{
              width: `${Math.max(0, (swipeX / (swipeContainerRef.current?.offsetWidth || 1)) * 100)}%`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-medium pointer-events-none text-sm">
            {loading ? "Purging..." : isDragging ? (() => {
              const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
              const buttonWidth = 48;
              const maxSwipe = containerWidth - buttonWidth - 8;
              const threshold = maxSwipe * 0.7;
              return swipeX >= threshold ? "Release to purge!" : "Keep swiping...";
            })() : "Swipe to Purge"}
          </div>
          <div
            className="h-12 w-12 bg-destructive rounded-sm flex items-center justify-center shadow-lg touch-none transition-all duration-200 ease-out"
            style={{
              transform: `translateX(${swipeX}px)`,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onTouchStart={(e) => {
              if (loading || confirmCode !== sessionCode) return;
              const touch = e.touches[0];
              setStartX(touch.clientX);
              setIsDragging(true);
              setSwipeX(0);
            }}
            onTouchMove={(e) => {
              if (!isDragging || loading) return;
              e.preventDefault();
              const touch = e.touches[0];
              const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
              const buttonWidth = 48;
              const maxSwipe = containerWidth - buttonWidth - 8;
              const deltaX = Math.max(0, Math.min(maxSwipe, touch.clientX - startX));
              setSwipeX(deltaX);
            }}
            onTouchEnd={() => {
              if (!isDragging || loading) return;
              const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
              const buttonWidth = 48;
              const maxSwipe = containerWidth - buttonWidth - 8;
              const threshold = maxSwipe * 0.7;
              if (swipeX >= threshold) {
                if ("vibrate" in navigator) navigator.vibrate(50);
                setSwipeX(maxSwipe);
                setTimeout(() => handleKill(), 150);
              } else {
                setSwipeX(0);
              }
              setIsDragging(false);
            }}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Trash2 className="h-5 w-5 text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Desktop Button */}
      <div className="hidden sm:flex justify-center pt-2">
        <Button
          variant="destructive"
          onClick={handleKill}
          disabled={loading || confirmCode !== sessionCode}
          className="w-full"
        >
          {loading ? "Purging..." : "Purge Session"}
        </Button>
      </div>
    </div>
  );
}
