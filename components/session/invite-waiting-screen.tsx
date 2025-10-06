"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getDeviceInfo } from "@/lib/device";
import { useRouter } from "next/navigation";

type Device = {
  id: string;
  session_code: string;
  device_id: string;
  device_name?: string;
  is_host?: boolean | null;
  last_seen: string;
  created_at: string;
};

type JoinRequest = {
  id: string;
  session_code: string;
  device_id: string;
  device_name?: string;
  requesting_device_info: any;
  status: "pending" | "approved" | "denied";
  created_at: string;
};

export default function InviteWaitingScreen({
  code,
  deviceId,
}: {
  code: string;
  deviceId: string;
}) {
  const supabase = getSupabaseBrowserWithCode(code);
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [currentDevice, setCurrentDevice] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [sessionExists, setSessionExists] = useState<boolean | null>(null);

  useEffect(() => {
    const deviceInfo = getDeviceInfo();
    setCurrentDevice(deviceInfo);
    setIsHost(localStorage.getItem(`pp-host-${code}`) === "1");
  }, [code]);

  useEffect(() => {
    if (!supabase) return;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("code")
          .eq("code", code)
          .single();

        setSessionExists(!error && !!data);
      } catch (e) {
        setSessionExists(false);
      }
    };

    checkSession();
  }, [supabase, code]);

  useEffect(() => {
    if (!supabase || sessionExists === null) return;

    const fetchDevices = async () => {
      try {
        const { data, error } = await supabase
          .from("devices")
          .select("*")
          .eq("session_code", code)
          .order("created_at", { ascending: true });

        if (!error && data) {
          setDevices(data);
        }
      } catch (e) {
        console.error("Failed to fetch devices:", e);
      }
    };

    fetchDevices();

    // Set up real-time subscription for devices
    const channel = supabase
      .channel(`invite-devices-${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        () => {
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, code, sessionExists]);

  const requestToJoin = async () => {
    if (!supabase || !currentDevice) return;

    try {
      // Try to register device directly first
      const { error } = await supabase
        .from("devices")
        .upsert({
          session_code: code,
          device_id: currentDevice.id,
          device_name: currentDevice.name,
          is_host: false,
        })
        .select()
        .single();

      if (!error) {
        // Successfully joined, redirect to session
        router.push(`/session/${code}?join=1`);
      }
    } catch (e: any) {
      console.error("Failed to join session:", e);
    }
  };

  const approveDevice = async (deviceIdToApprove: string) => {
    if (!supabase || !isHost) return;

    try {
      // In a real implementation, you might have a join_requests table
      // For now, we'll just allow the device to join
      console.log("Approving device:", deviceIdToApprove);
    } catch (e) {
      console.error("Failed to approve device:", e);
    }
  };

  const kickDevice = async (deviceIdToKick: string) => {
    if (!supabase || !isHost) return;

    try {
      await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", deviceIdToKick);
    } catch (e) {
      console.error("Failed to kick device:", e);
    }
  };

  if (sessionExists === null) {
    return (
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-4xl text-center">
          <div className="text-muted-foreground">Checking session...</div>
        </div>
      </main>
    );
  }

  if (!sessionExists) {
    return (
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-4xl text-center">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-destructive">
                Session Not Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Session {code} does not exist or has been deleted.
              </p>
              <Button onClick={() => router.push("/")} variant="default">
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold">
            Session {code}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {isHost ? "Manage connected devices" : "Waiting to join session"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current Device Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Your Device
                {isHost && <Badge variant="secondary">Host</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentDevice && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Device Name
                    </label>
                    <p className="text-lg font-semibold">
                      {currentDevice.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Device ID
                    </label>
                    <p className="text-sm font-mono">
                      {currentDevice.id.slice(0, 8)}...
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Platform
                    </label>
                    <p className="text-sm">{currentDevice.platform}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Device Type
                    </label>
                    <p className="text-sm">
                      {currentDevice.isMobile ? "Mobile" : "Desktop"}
                    </p>
                  </div>

                  {!isHost && (
                    <div className="pt-4">
                      <Button onClick={requestToJoin} className="w-full">
                        Request to Join Session
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connected Devices */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Devices ({devices.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No devices connected yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold truncate">
                            {device.device_name || device.device_id.slice(0, 8)}
                          </span>
                          {device.is_host && (
                            <Badge variant="default" className="text-xs">
                              Host
                            </Badge>
                          )}
                          {device.device_id === currentDevice?.id && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>ID: {device.device_id.slice(0, 8)}...</span>
                          <span>
                            Joined:{" "}
                            {new Date(device.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      {isHost && device.device_id !== currentDevice?.id && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => kickDevice(device.device_id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.push("/")} variant="outline">
              Go Home
            </Button>
            <Button
              onClick={() => router.push(`/session/${code}`)}
              variant="default"
            >
              {devices.some((d) => d.device_id === currentDevice?.id)
                ? "Enter Session"
                : "View Session"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
