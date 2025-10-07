"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import { generateSessionKey, decryptDeviceName } from "@/lib/encryption";
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Crown,
  Snowflake,
  Play,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  UserCheck,
  AlertTriangle,
  Timer,
  ChevronDown,
  ChevronUp,
  Globe,
  Clock,
  Info,
  Copy,
  Check,
} from "lucide-react";

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
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [showTransferHost, setShowTransferHost] = useState(false);
  const [killConfirmCode, setKillConfirmCode] = useState("");
  const [selectedNewHost, setSelectedNewHost] = useState("");
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(
    new Set()
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [autoRefreshInterval] = useState(3000); // 3 seconds default
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    setIsHost(localStorage.getItem(`pp-host-${code}`) === "1");
  }, [code]);

  const toggleDeviceExpansion = (deviceId: string) => {
    const newExpanded = new Set(expandedDevices);
    if (newExpanded.has(deviceId)) {
      newExpanded.delete(deviceId);
    } else {
      newExpanded.add(deviceId);
    }
    setExpandedDevices(newExpanded);
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (
      name.includes("iphone") ||
      name.includes("android") ||
      name.includes("mobile")
    ) {
      return <Smartphone className="h-4 w-4" />;
    } else if (name.includes("ipad") || name.includes("tablet")) {
      return <Tablet className="h-4 w-4" />;
    } else if (name.includes("mac") || name.includes("laptop")) {
      return <Laptop className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const formatLastSeen = (lastSeen: string) => {
    const diff = Date.now() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  useEffect(() => {
    setSelfId(getOrCreateDeviceId());
    // Initialize session encryption key
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let heartbeatInterval: NodeJS.Timeout;

    const updateHeartbeat = async () => {
      try {
        await supabase
          .from("devices")
          .update({ last_seen: new Date().toISOString() })
          .eq("session_code", code)
          .eq("device_id", selfId);
      } catch (e) {
        console.warn("Failed to update heartbeat:", e);
      }
    };

    const fetchDevices = async () => {
      try {
        setError(null);

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

    // Auto-refresh interval
    const autoRefreshIntervalId = setInterval(() => {
      fetchDevices();
    }, autoRefreshInterval);

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
          console.log("Device change detected in devices panel:", payload);
          console.log("Event type:", payload.eventType);
          console.log("New data:", payload.new);
          console.log("Old data:", payload.old);
          fetchDevices();
        }
      )
      .subscribe((status) => {
        console.log("Devices subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Real-time subscription active for devices");
        }
      });

    // Listen for session termination
    const killChannel = supabase
      .channel(`session-kill-listener-${code}`)
      .on("broadcast", { event: "session_killed" }, (payload) => {
        if (payload.payload.code === code) {
          startKillCountdown();
        }
      })
      .subscribe();

    // Start heartbeat system - update every 30 seconds
    if (selfId) {
      updateHeartbeat(); // Initial heartbeat
      heartbeatInterval = setInterval(updateHeartbeat, 30000);
    }

    return () => {
      cancelled = true;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
      supabase.removeChannel(channel);
      supabase.removeChannel(killChannel);
    };
  }, [supabase, code, sessionKey, refreshTrigger, autoRefreshInterval]);

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
    console.log(
      `Toggling freeze for device ${deviceId}: ${currentStatus} -> ${!currentStatus}`
    );
    setLoading((prev) => ({ ...prev, [`freeze-${deviceId}`]: true }));
    try {
      const { data, error } = await supabase
        .from("devices")
        .update({ is_frozen: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .select();
      if (error) throw error;
      console.log("Freeze toggle result:", data);
      // Trigger component refresh
      setRefreshTrigger((prev) => prev + 1);
    } catch (e: any) {
      setError(e?.message || "Failed to update device status.");
    } finally {
      setLoading((prev) => ({ ...prev, [`freeze-${deviceId}`]: false }));
    }
  };

  const toggleView = async (deviceId: string, currentStatus: boolean) => {
    if (!supabase) return;
    console.log(
      `Toggling view for device ${deviceId}: ${currentStatus} -> ${!currentStatus}`
    );
    setLoading((prev) => ({ ...prev, [`view-${deviceId}`]: true }));
    try {
      const { data, error } = await supabase
        .from("devices")
        .update({ can_view: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .select();
      if (error) throw error;
      console.log("View toggle result:", data);
      // Trigger component refresh
      setRefreshTrigger((prev) => prev + 1);
    } catch (e: any) {
      setError(e?.message || "Failed to update device permissions.");
    } finally {
      setLoading((prev) => ({ ...prev, [`view-${deviceId}`]: false }));
    }
  };

  const leaveSession = async (deviceId: string, isHostDevice?: boolean) => {
    if (!supabase) return;

    if (isHostDevice && devices.length > 1) {
      // Host needs to transfer privileges first
      setShowTransferHost(true);
      return;
    }

    setLoading((prev) => ({ ...prev, [`leave-${deviceId}`]: true }));
    try {
      // Remove device from database
      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", deviceId);

      if (error) throw error;

      // Clear local storage and redirect
      localStorage.removeItem(`pp-host-${code}`);
      localStorage.removeItem(`pp-joined-${code}`);
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.message || "Failed to leave session.");
    } finally {
      setLoading((prev) => ({ ...prev, [`leave-${deviceId}`]: false }));
    }
  };

  const transferHostAndLeave = async () => {
    if (!supabase || !selectedNewHost) return;

    setLoading((prev) => ({ ...prev, transferHost: true }));
    try {
      // Transfer host privileges
      await supabase
        .from("devices")
        .update({ is_host: false })
        .eq("session_code", code)
        .eq("device_id", selfId);

      await supabase
        .from("devices")
        .update({ is_host: true })
        .eq("session_code", code)
        .eq("device_id", selectedNewHost);

      // Remove current device
      await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", selfId);

      // Clear local storage and redirect
      localStorage.removeItem(`pp-host-${code}`);
      localStorage.removeItem(`pp-joined-${code}`);
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.message || "Failed to transfer host privileges.");
    } finally {
      setLoading((prev) => ({ ...prev, transferHost: false }));
      setShowTransferHost(false);
    }
  };

  const killSession = async () => {
    if (!supabase || killConfirmCode !== code) return;

    setLoading((prev) => ({ ...prev, killSession: true }));
    try {
      // Delete all items
      await supabase.from("items").delete().eq("session_code", code);

      // Delete all devices
      await supabase.from("devices").delete().eq("session_code", code);

      // Delete session
      await supabase.from("sessions").delete().eq("code", code);

      // Broadcast session termination
      await supabase.channel(`session-kill-${code}`).send({
        type: "broadcast",
        event: "session_killed",
        payload: { code },
      });

      // Start countdown and redirect
      startKillCountdown();
    } catch (e: any) {
      setError(e?.message || "Failed to kill session.");
      setLoading((prev) => ({ ...prev, killSession: false }));
    }
  };

  const startKillCountdown = () => {
    let count = 5;
    const countdownInterval = setInterval(() => {
      if (count <= 0) {
        clearInterval(countdownInterval);
        window.location.href = "/";
        return;
      }

      // Show countdown in UI
      setError(`Session terminated by host. Redirecting in ${count}...`);
      count--;
    }, 1000);
  };

  if (!supabase) return null;

  return (
    <div>
      {error && (
        <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
          {error}
        </div>
      )}

      <div className="relative">
        <ul className="flex flex-col gap-3">
          {devices.map((d) => {
            const timeSinceLastSeen =
              new Date().getTime() - new Date(d.last_seen).getTime();
            const isOnline = timeSinceLastSeen < 60000; // Within 1 minute
            const isExpanded = expandedDevices.has(d.device_id);

            return (
              <li
                key={d.id}
                className="bg-card border rounded-xl p-4 hover:shadow-md transition-all duration-200"
              >
                {/* Main Device Info Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isOnline
                            ? "bg-green-500 animate-pulse"
                            : "bg-gray-400"
                        }`}
                        title={isOnline ? "Online" : "Offline"}
                      />
                      {getDeviceIcon(d.device_name || "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">
                          {d.device_name || `Device ${d.device_id.slice(0, 8)}`}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {d.device_id === selfId && (
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              You
                            </span>
                          )}
                          {d.is_host && (
                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Crown className="h-3 w-3" />
                              Host
                            </span>
                          )}
                          {d.is_frozen && (
                            <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Snowflake className="h-3 w-3" />
                              Frozen
                            </span>
                          )}
                          {d.can_view === false && (
                            <span className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <EyeOff className="h-3 w-3" />
                              Hidden
                            </span>
                          )}
                          {!isOnline && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatLastSeen(d.last_seen)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expand Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleDeviceExpansion(d.device_id)}
                    className="h-8 w-8 p-0 rounded-full hover:bg-muted/50"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Info className="h-3 w-3" />
                          <span className="font-medium">Device Details</span>
                        </div>
                        <div className="pl-5 space-y-1">
                          <div>
                            <span className="text-xs text-muted-foreground">
                              Device ID:
                            </span>
                            <p className="font-mono text-xs text-foreground break-all">
                              {d.device_id}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">
                              Joined:
                            </span>
                            <p className="text-xs">
                              {new Date(d.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          <span className="font-medium">Connection Info</span>
                        </div>
                        <div className="pl-5 space-y-1">
                          <div>
                            <span className="text-xs text-muted-foreground">
                              Status:
                            </span>
                            <p className="text-xs">
                              {isOnline ? "Active" : "Inactive"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">
                              Last Activity:
                            </span>
                            <p className="text-xs">
                              {new Date(d.last_seen).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end sm:justify-start mt-3 pt-3 border-t">
                  {/* Leave button for current user */}
                  {d.device_id === selfId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        leaveSession(d.device_id, d.is_host || false)
                      }
                      disabled={loading[`leave-${d.device_id}`]}
                      className="text-xs px-2 py-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      {loading[`leave-${d.device_id}`]
                        ? "..."
                        : "Leave Session"}
                    </Button>
                  )}

                  {/* Host controls for other devices */}
                  {isHost && d.device_id !== selfId && (
                    <>
                      <Button
                        size="sm"
                        variant={d.is_frozen ? "default" : "outline"}
                        onClick={() =>
                          toggleFreeze(d.device_id, d.is_frozen || false)
                        }
                        disabled={loading[`freeze-${d.device_id}`]}
                        className="text-xs px-2 py-1"
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
                        onClick={() =>
                          toggleView(d.device_id, d.can_view !== false)
                        }
                        disabled={loading[`view-${d.device_id}`]}
                        className="text-xs px-2 py-1"
                      >
                        {loading[`view-${d.device_id}`]
                          ? "..."
                          : d.can_view === false
                          ? "Show"
                          : "Hide"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => kick(d.device_id)}
                        disabled={loading[d.device_id]}
                        className="text-xs px-2 py-1"
                      >
                        {loading[d.device_id] ? "..." : "Remove"}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {devices.length === 0 && !error && (
            <li className="text-center text-muted-foreground text-sm py-4">
              No devices connected yet.
            </li>
          )}
        </ul>
      </div>

      {/* Host Transfer Dialog */}
      <Dialog open={showTransferHost} onOpenChange={setShowTransferHost}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Host Privileges</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              As the host, you must transfer your privileges to another device
              before leaving.
            </p>
            <Select value={selectedNewHost} onValueChange={setSelectedNewHost}>
              <SelectTrigger>
                <SelectValue placeholder="Select new host device" />
              </SelectTrigger>
              <SelectContent>
                {devices
                  .filter((d) => d.device_id !== selfId)
                  .map((d) => (
                    <SelectItem key={d.device_id} value={d.device_id}>
                      {d.device_name || d.device_id.slice(0, 8)} -{" "}
                      {d.device_id.slice(0, 12)}...
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTransferHost(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={transferHostAndLeave}
              disabled={!selectedNewHost || loading.transferHost}
            >
              {loading.transferHost ? "Transferring..." : "Transfer & Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              disabled={killConfirmCode !== code || loading.killSession}
            >
              {loading.killSession ? "Killing Session..." : "Kill Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
