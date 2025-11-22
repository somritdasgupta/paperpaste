"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId, getDeviceInfo, heartbeat } from "@/lib/device";
import { setSessionJoined } from "@/lib/session-validation";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  ArrowRight,
  Shield,
  Check,
  Loader2,
  AlertTriangle,
  Globe,
  QrCode as QrCodeIcon,
} from "lucide-react";
import Footer from "@/components/ui/footer";

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
  const [hostDeviceName, setHostDeviceName] = useState<string | null>(null);
  const [invite, setInvite] = useState(`/session/${code}`); // Start with relative URL
  const deviceIdRef = useRef<string | null>(null);

  // Swipe gesture state
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const swipeButtonRef = useRef<HTMLDivElement>(null);

  // Update invite URL after hydration to prevent SSR mismatch
  useEffect(() => {
    setInvite(`${window.location.origin}/session/${code}`);
  }, [code]);

  // Handle global mouse events for better drag experience
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || busy) return;
      const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
      const buttonWidth = 56;
      const maxSwipe = containerWidth - buttonWidth - 8;
      const deltaX = Math.max(0, Math.min(maxSwipe, e.clientX - startX));
      setSwipeX(deltaX);
    };

    const handleGlobalMouseUp = () => {
      if (!isDragging || busy) return;
      const containerWidth = swipeContainerRef.current?.offsetWidth || 0;
      const buttonWidth = 56;
      const maxSwipe = containerWidth - buttonWidth - 8;
      const threshold = maxSwipe * 0.7;

      if (swipeX >= threshold) {
        setSwipeX(maxSwipe);
        setTimeout(() => getIn(), 150);
      } else {
        setSwipeX(0);
      }
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, startX, swipeX, busy]);

  // Create session for host if new, and flag host locally
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        deviceIdRef.current = getOrCreateDeviceId();

        // Check if device is already registered for this session
        const { data: existingDevice } = await supabase
          .from("devices")
          .select("*")
          .eq("session_code", code)
          .eq("device_id", deviceIdRef.current)
          .single();

        if (existingDevice) {
          // Device already exists, auto-join
          router.replace(`/session/${code}?join=1`);
          return;
        }

        if (isNew) {
          localStorage.setItem(`pp-host-${code}`, "1");
          // upsert session row if not exists - wait for completion
          const sessionResult = await supabase
            .from("sessions")
            .upsert({ code })
            .select()
            .single();
          if (sessionResult.error) {
            throw new Error(
              `Failed to create session: ${sessionResult.error.message}`
            );
          }
        } else {
          // Fetch host device information for personalization
          const { data: hostDevice } = await supabase
            .from("devices")
            .select("device_name_encrypted")
            .eq("session_code", code)
            .eq("is_host", true)
            .single();

          if (hostDevice?.device_name_encrypted) {
            try {
              const sessionKey = await import("@/lib/encryption").then((m) =>
                m.generateSessionKey(code)
              );
              const decryptedName = await import("@/lib/encryption").then((m) =>
                m.decryptDeviceName(
                  hostDevice.device_name_encrypted,
                  sessionKey
                )
              );
              setHostDeviceName(decryptedName);
            } catch (decryptionError) {
              console.warn(
                "Failed to decrypt host device name:",
                decryptionError
              );
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to initialize session.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, code, isNew, router]);

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

      // register device presence (idempotent) with retry logic for foreign key constraint
      let deviceResult;
      let retries = 3;

      while (retries > 0) {
        deviceResult = await supabase
          .from("devices")
          .upsert({
            session_code: code,
            device_id: deviceId,
            device_name_encrypted: encryptedDeviceName,
            is_host: isHost as any,
          })
          .select()
          .single();

        if (!deviceResult.error) {
          break; // Success, exit retry loop
        }

        // If it's a foreign key constraint error, wait and retry
        if (deviceResult.error.code === "23503" && retries > 1) {
          console.log(
            `Foreign key constraint error, retrying... (${
              retries - 1
            } attempts left)`
          );
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms
          retries--;
        } else {
          throw deviceResult.error;
        }
      }
      // start heartbeat
      heartbeat(supabase, code, deviceId);
      // mark session as joined
      setSessionJoined(code, deviceId);
      // enter session view
      router.replace(`/session/${code}?join=1`);
    } catch (e: any) {
      setError(e?.message || "Failed to join session.");
    } finally {
      setBusy(false);
    }
  };

  // NOTE: device icon is determined on the client after mount. See
  // renderDetectedDeviceIcon() below.

  // Detect device type on client; start with a neutral default so server
  // and client initial HTML match.
  const [detectedDeviceType, setDetectedDeviceType] = useState<
    "smartphone" | "tablet" | "laptop" | "monitor"
  >("monitor");

  useEffect(() => {
    try {
      const ua = navigator.userAgent.toLowerCase();
      if (/mobile|android|iphone/.test(ua)) {
        setDetectedDeviceType("smartphone");
        return;
      }
      if (/tablet|ipad/.test(ua)) {
        setDetectedDeviceType("tablet");
        return;
      }
      if (/mac|windows|linux/.test(ua)) {
        setDetectedDeviceType("laptop");
        return;
      }
    } catch (e) {
      // if navigator isn't available, keep default
    }
  }, []);

  const renderDetectedDeviceIcon = () => {
    switch (detectedDeviceType) {
      case "smartphone":
        return <Smartphone className="h-8 w-8" />;
      case "tablet":
        return <Tablet className="h-8 w-8" />;
      case "laptop":
        return <Laptop className="h-8 w-8" />;
      default:
        return <Monitor className="h-8 w-8" />;
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-background via-background to-muted/30 flex flex-col">
      {/* Background Graphics - Fixed */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[4rem_4rem]"></div>

        {/* Gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full">
        {/* Single Modern Card */}
        <Card className="p-6 sm:p-10 border-2 hover:border-primary/20 transition-colors backdrop-blur-sm bg-card/95">
          <CardContent className="space-y-8 p-0">
            {/* Header Section */}
            <div className="text-center space-y-4">
              <Badge
                variant="secondary"
                className="px-5 py-2.5 text-2xl font-bold session-code shadow-lg"
              >
                {code}
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {isNew ? "Session Ready" : "Join Session"}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
                {isNew
                  ? "Share the QR code or link to connect devices securely."
                  : hostDeviceName
                    ? `Connect to ${hostDeviceName}'s session.`
                    : "Connect this device to share clipboard data."}
              </p>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="bg-white p-6 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      invite
                    )}`}
                    alt="Session QR Code"
                    width={200}
                    height={200}
                    className="rounded"
                  />
                </div>
                <div className="absolute -top-2 -right-2 bg-green-500 text-white p-2 rounded-full shadow-lg">
                  <QrCodeIcon className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Device Info */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {renderDetectedDeviceIcon()}
              <span>
                {isNew ? "Starting as host" : "Joining as participant"}
              </span>
            </div>

            {/* Action Button Section */}
            <div className="space-y-4">
              {/* Mobile Swipe to Join */}
              <div className="block sm:hidden">
                <div
                  ref={swipeContainerRef}
                  className="relative bg-muted rounded-sm p-1 h-16 overflow-hidden select-none"
                  style={{ touchAction: "pan-x" }}
                >
                  {/* Progress indicator */}
                  <div
                    className="absolute left-1 top-1 bottom-1 bg-primary/20 rounded-sm transition-all duration-200 ease-out"
                    style={{
                      width: `${Math.max(
                        0,
                        (swipeX /
                          (swipeContainerRef.current?.offsetWidth || 1)) *
                          100
                      )}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-medium pointer-events-none">
                    {busy
                      ? "Connecting..."
                      : isDragging
                        ? (() => {
                            const containerWidth =
                              swipeContainerRef.current?.offsetWidth || 0;
                            const buttonWidth = 56;
                            const maxSwipe = containerWidth - buttonWidth - 8;
                            const threshold = maxSwipe * 0.7;
                            return swipeX >= threshold
                              ? "Release to join!"
                              : "Keep swiping...";
                          })()
                        : `Swipe to ${isNew ? "Start" : "Join"}`}
                  </div>
                  <div
                    ref={swipeButtonRef}
                    className="h-14 w-14 bg-linear-to-r from-primary to-primary/90 rounded-sm flex items-center justify-center shadow-lg touch-none transition-all duration-200 ease-out"
                    style={{
                      transform: `translateX(${swipeX}px)`,
                      cursor: isDragging ? "grabbing" : "grab",
                    }}
                    onTouchStart={(e) => {
                      if (busy) return;
                      const touch = e.touches[0];
                      setStartX(touch.clientX);
                      setIsDragging(true);
                      setSwipeX(0);
                    }}
                    onTouchMove={(e) => {
                      if (!isDragging || busy) return;
                      e.preventDefault();
                      const touch = e.touches[0];
                      const containerWidth =
                        swipeContainerRef.current?.offsetWidth || 0;
                      const buttonWidth = 56; // 14 * 4 (h-14 = 56px)
                      const maxSwipe = containerWidth - buttonWidth - 8; // 8px for padding
                      const deltaX = Math.max(
                        0,
                        Math.min(maxSwipe, touch.clientX - startX)
                      );
                      setSwipeX(deltaX);
                    }}
                    onTouchEnd={() => {
                      if (!isDragging || busy) return;
                      const containerWidth =
                        swipeContainerRef.current?.offsetWidth || 0;
                      const buttonWidth = 56;
                      const maxSwipe = containerWidth - buttonWidth - 8;
                      const threshold = maxSwipe * 0.7; // 70% of the way

                      if (swipeX >= threshold) {
                        // Complete the swipe and trigger action
                        // Add haptic feedback if available
                        if ("vibrate" in navigator) {
                          navigator.vibrate(50);
                        }
                        setSwipeX(maxSwipe);
                        setTimeout(() => getIn(), 150);
                      } else {
                        // Snap back to start
                        setSwipeX(0);
                      }
                      setIsDragging(false);
                    }}
                    onMouseDown={(e) => {
                      if (busy) return;
                      setStartX(e.clientX);
                      setIsDragging(true);
                      setSwipeX(0);
                    }}
                    onMouseLeave={() => {
                      // Only handle mouse leave if we're not in a global drag state
                      if (isDragging && !busy && swipeX === 0) {
                        setIsDragging(false);
                      }
                    }}
                    onClick={(e) => {
                      // Fallback for simple tap/click if no dragging occurred
                      if (!isDragging && swipeX === 0) {
                        getIn();
                      }
                    }}
                  >
                    {busy ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <ArrowRight className="h-6 w-6 text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Button */}
              <div className="hidden sm:block">
                <Button
                  size="lg"
                  onClick={getIn}
                  disabled={busy}
                  className="w-full py-4 text-lg font-semibold gap-3 bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      {isNew ? "Start Session" : "Join Session"}
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            End-to-end encrypted • No data stored on servers
          </p>
        </div>
        </div>
      </div>
      
      <Footer />
    </main>
  );
}
