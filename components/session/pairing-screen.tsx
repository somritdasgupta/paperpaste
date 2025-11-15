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
  Crown,
  Users,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";

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
    <main className="min-h-full bg-linear-to-br from-background via-background to-muted/30 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 rounded-sm bg-primary/10 border border-primary/20">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <div className="h-8 w-px bg-border" />
            <Badge
              variant="secondary"
              className="px-4 py-2 text-lg font-semibold session-code"
            >
              {code}
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3">
            {isNew ? "Session Created" : "Join Session"}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {isNew
              ? "Your secure session is ready. Share the link or QR code to connect devices."
              : hostDeviceName
              ? `Connect to ${hostDeviceName}'s session to start sharing clipboard data securely.`
              : "Connect this device to start sharing clipboard data securely in real-time."}
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Left Side - QR Code */}
          <Card className="p-4 sm:p-8 text-center border-2 hover:border-primary/20 transition-colors">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center justify-center gap-2 text-xl">
                <Shield className="h-5 w-5 text-primary" />
                Let's Connect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative inline-block">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-sm blur-lg opacity-30"></div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    invite
                  )}&bgcolor=FFFFFF&color=000000&margin=20`}
                  alt="Session QR Code"
                  width={240}
                  height={240}
                  className="relative rounded-sm border-2 border-muted shadow-xl"
                />
              </div>
              <div className="p-4 bg-muted/50 rounded-sm border">
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {invite}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right Side - Device Connection */}
          <Card className="p-4 sm:p-8 border-2 hover:border-primary/20 transition-colors">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center justify-center gap-2 text-xl">
                {renderDetectedDeviceIcon()}
                <CardDescription className="text-sm sm:text-base text-center">
                  {isNew ? "Start as session host" : "Join as participant"}
                </CardDescription>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Features */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-sm bg-primary/5 border border-primary/10">
                  <div className="p-2 rounded-sm bg-primary/10">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Real-time Sync</p>
                    <p className="text-xs text-muted-foreground">
                      Instant clipboard sharing
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-sm bg-green-500/5 border border-green-500/10">
                  <div className="p-2 rounded-sm bg-green-500/10">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      End-to-End Encrypted
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your data stays private
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-sm bg-blue-500/5 border border-blue-500/10">
                  <div className="p-2 rounded-sm bg-blue-500/10">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      Multi-Device Support
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Connect unlimited devices
                    </p>
                  </div>
                </div>
                {isNew && (
                  <div className="flex items-center gap-3 p-3 rounded-sm bg-amber-500/5 border border-amber-500/10">
                    <div className="p-2 rounded-sm bg-amber-500/10">
                      <Crown className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Host Privileges</p>
                      <p className="text-xs text-muted-foreground">
                        Manage session and devices
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Swipe to Join / Desktop Button */}
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
                    className="h-14 w-14 bg-gradient-to-r from-primary to-primary/90 rounded-sm flex items-center justify-center shadow-lg touch-none transition-all duration-200 ease-out"
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
                  className="w-full py-4 text-lg font-semibold gap-3 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
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
                <div className="flex items-center gap-3 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            PaperPaste is built on E2E encryption • No data stored on servers
          </p>
        </div>
      </div>
    </main>
  );
}
