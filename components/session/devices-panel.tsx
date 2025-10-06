"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import { generateSessionKey, decryptDeviceName } from "@/lib/encryption";

type Device = {
  id: string;
  session_code: string;
  device_id: string;
  device_name_encrypted?: string;
  device_name?: string; // decrypted name for display
  last_seen: string;
  is_host?: boolean | null;
  created_at: string;
  is_frozen?: boolean;
  can_view?: boolean;
};

export default function DevicesPanel({ code }: { code: string }) {
  const supabase = getSupabaseBrowserWithCode(code);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selfId, setSelfId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const isHost =
    typeof window !== "undefined" &&
    localStorage.getItem(`pp-host-${code}`) === "1";

  useEffect(() => {
    setSelfId(getOrCreateDeviceId());
    // Initialize session encryption key
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const fetchDevices = async () => {
      try {
        const { data, error } = await supabase
          .from("devices")
          .select("*")
          .eq("session_code", code)
          .order("created_at", { ascending: true });
        if (error) throw error;

        if (!cancelled && data && sessionKey) {
          // Decrypt device names
          const decryptedDevices = await Promise.all(
            data.map(async (device) => {
              let deviceName = "Anonymous Device";
              if (device.device_name_encrypted) {
                try {
                  deviceName = await decryptDeviceName(
                    device.device_name_encrypted,
                    sessionKey
                  );
                } catch (e) {
                  console.warn("Failed to decrypt device name:", e);
                }
              }
              return { ...device, device_name: deviceName };
            })
          );
          setDevices(decryptedDevices);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to fetch devices.");
      }
    };

    fetchDevices();

    // setup real-time with better error handling
    const channel = supabase
      .channel(`session-devices-${code}`, {
        config: {
          broadcast: { self: true },
          presence: { key: code },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        (payload) => {
          console.log("Device change detected:", payload);
          fetchDevices();
        }
      )
      .subscribe((status) => {
        console.log("Devices subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Real-time subscription active for devices");
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, code, sessionKey]);

  const kick = async (deviceId: string) => {
    if (!supabase) return;
    setLoading((prev) => ({ ...prev, [deviceId]: true }));
    try {
      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", deviceId);
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Failed to remove device.");
    } finally {
      setLoading((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  const toggleFreeze = async (deviceId: string, currentStatus: boolean) => {
    if (!supabase) return;
    setLoading((prev) => ({ ...prev, [`freeze-${deviceId}`]: true }));
    try {
      const { error } = await supabase
        .from("devices")
        .update({ is_frozen: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId);
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Failed to update device status.");
    } finally {
      setLoading((prev) => ({ ...prev, [`freeze-${deviceId}`]: false }));
    }
  };

  const toggleView = async (deviceId: string, currentStatus: boolean) => {
    if (!supabase) return;
    setLoading((prev) => ({ ...prev, [`view-${deviceId}`]: true }));
    try {
      const { error } = await supabase
        .from("devices")
        .update({ can_view: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId);
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Failed to update device permissions.");
    } finally {
      setLoading((prev) => ({ ...prev, [`view-${deviceId}`]: false }));
    }
  };

  if (!supabase) return null;

  return (
    <div>
      {error && (
        <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
          {error}
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {devices.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold truncate">
                  {d.device_name || d.device_id.slice(0, 8)}
                </span>
                {d.device_id === selfId && (
                  <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    You
                  </span>
                )}
                {d.is_host && (
                  <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    Host
                  </span>
                )}
                {d.is_frozen && (
                  <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    Frozen
                  </span>
                )}
                {d.can_view === false && (
                  <span className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    No View
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>ID: {d.device_id.slice(0, 8)}...</span>
                <span>
                  Last seen: {new Date(d.last_seen).toLocaleTimeString()}
                </span>
              </div>
            </div>
            {isHost && d.device_id !== selfId && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toggleFreeze(d.device_id, d.is_frozen || false)
                  }
                  disabled={loading[`freeze-${d.device_id}`]}
                  className="text-xs"
                >
                  {loading[`freeze-${d.device_id}`]
                    ? "..."
                    : d.is_frozen
                    ? "Unfreeze"
                    : "Freeze"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleView(d.device_id, d.can_view !== false)}
                  disabled={loading[`view-${d.device_id}`]}
                  className="text-xs"
                >
                  {loading[`view-${d.device_id}`]
                    ? "..."
                    : d.can_view === false
                    ? "Allow"
                    : "Hide"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => kick(d.device_id)}
                  disabled={loading[d.device_id]}
                  className="text-xs"
                >
                  {loading[d.device_id] ? "..." : "Remove"}
                </Button>
              </div>
            )}
          </li>
        ))}
        {devices.length === 0 && !error && (
          <li className="text-center text-muted-foreground text-sm py-4">
            No devices connected yet.
          </li>
        )}
      </ul>
    </div>
  );
}
