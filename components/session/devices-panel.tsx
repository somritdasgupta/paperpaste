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
import { subscribeToGlobalRefresh } from "@/lib/globalRefresh";
import { triggerGlobalRefresh } from "@/lib/globalRefresh";
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
  Loader2,
  Download,
  Ban,
} from "lucide-react";
import MaskedOverlay from "@/components/ui/masked-overlay";

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
  can_export?: boolean;
  can_delete_items?: boolean;
};

export default function DevicesPanel({ code }: { code: string }) {
  const supabase = getSupabaseBrowserWithCode(code);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selfId, setSelfId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [showTransferHost, setShowTransferHost] = useState(false);
  const [selectedNewHost, setSelectedNewHost] = useState("");
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(
    new Set()
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null
  );
  const [redirectReason, setRedirectReason] = useState<string>("");

  useEffect(() => {
    setIsHost(localStorage.getItem(`pp-host-${code}`) === "1");
  }, [code]);

  const startRedirectCountdown = (reason: string) => {
    setRedirectReason(reason);
    setRedirectCountdown(5);

    const countdownInterval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          // Clear local storage and redirect
          localStorage.removeItem(`pp-host-${code}`);
          localStorage.removeItem(`pp-joined-${code}`);
          window.location.href = "/";
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

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

    // Subscribe to global refresh events instead of using a local interval.
    const unsubscribeRefresh = subscribeToGlobalRefresh(() => {
      fetchDevices();
    });

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

    // Listen for session termination and device kicks
    const killChannel = supabase
      .channel(`session-kill-listener-${code}`)
      .on("broadcast", { event: "session_killed" }, (payload) => {
        if (payload.payload.code === code) {
          startRedirectCountdown("Session terminated by host");
        }
      })
      .on("broadcast", { event: "device_kicked" }, (payload) => {
        if (payload.payload.device_id === selfId) {
          startRedirectCountdown("You have been removed from the session");
        }
      })
      .subscribe();

    // Also listen for direct device deletion
    const deviceChannel = supabase
      .channel(`device-listener-${selfId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "devices",
          filter: `device_id=eq.${selfId}`,
        },
        (payload) => {
          // Only trigger if it's for this session
          if (payload.old.session_code === code) {
            startRedirectCountdown(
              "Your device has been removed from the session"
            );
          }
        }
      )
      .subscribe();

    // Start heartbeat system - update every 30 seconds
    if (selfId) {
      updateHeartbeat(); // Initial heartbeat
      heartbeatInterval = setInterval(updateHeartbeat, 30000);
    }

    return () => {
      cancelled = true;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (unsubscribeRefresh) unsubscribeRefresh();
      supabase.removeChannel(channel);
      supabase.removeChannel(killChannel);
      supabase.removeChannel(deviceChannel);
    };
  }, [supabase, code, sessionKey, refreshTrigger, selfId]);

  const kick = async (deviceId: string) => {
    if (!supabase) return;
    setLoading((prev) => ({ ...prev, [deviceId]: true }));
    try {
      // Broadcast kick event before deleting
      await supabase.channel(`session-kill-listener-${code}`).send({
        type: "broadcast",
        event: "device_kicked",
        payload: { device_id: deviceId, code },
      });

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
      const newStatus = !currentStatus;

      // First broadcast the change for instant UI update
      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: deviceId, is_frozen: newStatus, can_view: true },
      });

      // Then update database
      const { data, error } = await supabase
        .from("devices")
        .update({ is_frozen: newStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .select();
      if (error) throw error;

      setRefreshTrigger((prev) => prev + 1);
      try {
        triggerGlobalRefresh();
      } catch {}
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
      const newStatus = !currentStatus;

      // First broadcast the change for instant UI update
      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: deviceId, can_view: newStatus, is_frozen: false },
      });

      // Then update database
      const { data, error } = await supabase
        .from("devices")
        .update({ can_view: newStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .select();
      if (error) throw error;

      setRefreshTrigger((prev) => prev + 1);
      try {
        triggerGlobalRefresh();
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to update device permissions.");
    } finally {
      setLoading((prev) => ({ ...prev, [`view-${deviceId}`]: false }));
    }
  };

  const toggleExport = async (deviceId: string, currentStatus: boolean) => {
    if (!supabase) return;
    setLoading((prev) => ({ ...prev, [`export-${deviceId}`]: true }));
    try {
      const newStatus = !currentStatus;

      // First broadcast the change for instant UI update
      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: deviceId, can_export: newStatus },
      });

      // Then update database
      const { data, error } = await supabase
        .from("devices")
        .update({ can_export: newStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .select();
      if (error) throw error;

      setRefreshTrigger((prev) => prev + 1);
      try {
        triggerGlobalRefresh();
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to update export permissions.");
    } finally {
      setLoading((prev) => ({ ...prev, [`export-${deviceId}`]: false }));
    }
  };

  const toggleDeleteItems = async (
    deviceId: string,
    currentStatus: boolean
  ) => {
    if (!supabase) return;
    setLoading((prev) => ({ ...prev, [`delete-${deviceId}`]: true }));
    try {
      const newStatus = !currentStatus;

      // First broadcast the change for instant UI update
      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: deviceId, can_delete_items: newStatus },
      });

      // Then update database
      const { data, error } = await supabase
        .from("devices")
        .update({ can_delete_items: newStatus })
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .select();
      if (error) throw error;

      setRefreshTrigger((prev) => prev + 1);
      try {
        triggerGlobalRefresh();
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to update delete permissions.");
    } finally {
      setLoading((prev) => ({ ...prev, [`delete-${deviceId}`]: false }));
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

  if (!supabase) return null;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Determine local device state and show global overlay/badge when
          current device is frozen or hidden. This keeps UI consistent with
          other components (dim + badge). */}
      {(() => {
        const local = devices.find((dd) => dd.device_id === selfId);
        // Only show the full-panel overlay when the local device is hidden (can_view === false).
        // If the device is frozen, we keep per-device frozen badges but do not block the devices panel UI.
        if (local && local.can_view === false) {
          return <MaskedOverlay variant="hidden" />;
        }
        return null;
      })()}

      {/* Scrollable devices area */}
      <div className="flex-1 overflow-y-auto relative">
        {redirectCountdown !== null && (
          <div className="m-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3 text-center">
            <div className="font-medium">{redirectReason}</div>
            <div className="text-xs mt-1">
              Redirecting to home in {redirectCountdown} seconds...
            </div>
          </div>
        )}

        {error && (
          <div className="m-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
            {error}
          </div>
        )}

        <ul className="flex flex-col gap-0.5 font-mono text-xs">
          {devices.map((d) => {
            const timeSinceLastSeen =
              new Date().getTime() - new Date(d.last_seen).getTime();
            const isOnline = timeSinceLastSeen < 60000; // Within 1 minute
            const isExpanded = expandedDevices.has(d.device_id);

            return (
              <li
                key={d.id}
                className="bg-linear-to-br from-card via-card/95 to-card/90 border border-primary/10 rounded overflow-hidden transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Main Device Card */}
                <div className="p-3 space-y-2.5">
                  {/* Top Row: Device Info + Actions + Expand Button */}
                  <div className="flex items-center gap-3">
                    {/* Device Identity */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Status Indicator + Icon */}
                      <div className="relative shrink-0">
                        <div className="relative">
                          <div className="text-primary">
                            {getDeviceIcon(d.device_name || "")}
                          </div>
                          {/* Status Badge Overlay */}
                          <div
                            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-card ${
                              isOnline
                                ? "bg-green-400 shadow-lg shadow-green-400/50"
                                : "bg-gray-400"
                            }`}
                            title={isOnline ? "Online" : "Offline"}
                          />
                        </div>
                      </div>

                      {/* Device Name & Status */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {d.device_name || `Device-${d.device_id.slice(0, 6)}`}
                        </h4>

                        {/* Badges Row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {d.device_id === selfId && (
                            <span className="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded text-[9px] font-semibold border border-blue-500/20">
                              YOU
                            </span>
                          )}
                          {d.is_host && (
                            <span className="bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded text-[9px] font-semibold flex items-center gap-0.5 border border-amber-500/20">
                              <Crown className="h-2.5 w-2.5" />
                              HOST
                            </span>
                          )}
                          {d.is_frozen && (
                            <span className="bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded text-[9px] font-semibold border border-orange-500/20">
                              FROZEN
                            </span>
                          )}
                          {d.can_view === false && (
                            <span className="bg-red-500/15 text-red-400 px-2 py-0.5 rounded text-[9px] font-semibold border border-red-500/20">
                              HIDDEN
                            </span>
                          )}
                          {!isOnline && (
                            <span className="text-[9px] text-muted-foreground/70 flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {formatLastSeen(d.last_seen)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons + Expand/Collapse Button */}
                    <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
                      {/* Host Action Buttons */}
                      {isHost && d.device_id !== selfId && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFreeze(d.device_id, d.is_frozen || false);
                            }}
                            disabled={loading[`freeze-${d.device_id}`]}
                            className="sm:h-7 h-6 sm:px-3 px-0 sm:w-auto w-6 text-[10px] font-medium rounded shrink-0 hover:bg-primary/15 hover:scale-105 transition-all"
                            title={
                              d.is_frozen ? "Unfreeze device" : "Freeze device"
                            }
                          >
                            {loading[`freeze-${d.device_id}`] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : d.is_frozen ? (
                              <>
                                <Play className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">
                                  Unfreeze
                                </span>
                              </>
                            ) : (
                              <>
                                <Snowflake className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Freeze</span>
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleView(d.device_id, d.can_view !== false);
                            }}
                            disabled={loading[`view-${d.device_id}`]}
                            className="sm:h-7 h-6 sm:px-3 px-0 sm:w-auto w-6 text-[10px] font-medium rounded shrink-0 hover:bg-primary/15 hover:scale-105 transition-all"
                            title={
                              d.can_view === false
                                ? "Show items to device"
                                : "Hide items from device"
                            }
                          >
                            {loading[`view-${d.device_id}`] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : d.can_view === false ? (
                              <>
                                <Eye className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Show</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Hide</span>
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExport(d.device_id, d.can_export !== false);
                            }}
                            disabled={loading[`export-${d.device_id}`]}
                            className="sm:h-6 sm:px-3 px-0 sm:w-auto w-6 text-[10px] font-medium rounded shrink-0 hover:bg-primary/15 hover:scale-105 transition-all"
                            title={
                              d.can_export === false
                                ? "Allow exporting history"
                                : "Block exporting history"
                            }
                          >
                            {loading[`export-${d.device_id}`] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : d.can_export === false ? (
                              <>
                                <Download className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">
                                  Allow Export
                                </span>
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">
                                  Block Export
                                </span>
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDeleteItems(
                                d.device_id,
                                d.can_delete_items !== false
                              );
                            }}
                            disabled={loading[`delete-${d.device_id}`]}
                            className="sm:h-7 h-6 sm:px-3 px-0 sm:w-auto w-6 text-[10px] font-medium rounded shrink-0 hover:bg-primary/15 hover:scale-105 transition-all"
                            title={
                              d.can_delete_items === false
                                ? "Allow deleting items"
                                : "Block deleting items"
                            }
                          >
                            {loading[`delete-${d.device_id}`] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : d.can_delete_items === false ? (
                              <>
                                <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">
                                  Allow Delete
                                </span>
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">
                                  Block Delete
                                </span>
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              kick(d.device_id);
                            }}
                            disabled={loading[d.device_id]}
                            className="sm:h-7 h-6 sm:px-3 px-0 sm:w-auto w-6 text-[10px] font-medium rounded shrink-0 hover:bg-destructive/15 hover:scale-105 transition-all text-destructive"
                            title="Remove device from session"
                          >
                            {loading[d.device_id] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Remove</span>
                              </>
                            )}
                          </Button>
                        </>
                      )}

                      {/* Leave Session Button for Current User */}
                      {d.device_id === selfId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            leaveSession(d.device_id, d.is_host || false);
                          }}
                          disabled={loading[`leave-${d.device_id}`]}
                          className="sm:h-7 h-6 sm:px-3 px-0 sm:w-auto w-6 text-[10px] font-medium rounded shrink-0 hover:bg-destructive/15 hover:scale-105 transition-all text-destructive"
                          title="Leave session"
                        >
                          {loading[`leave-${d.device_id}`] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <LogOut className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">
                                Leave Session
                              </span>
                            </>
                          )}
                        </Button>
                      )}

                      {/* Expand/Collapse Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newExpanded = new Set(expandedDevices);
                          if (isExpanded) {
                            newExpanded.delete(d.device_id);
                          } else {
                            newExpanded.add(d.device_id);
                          }
                          setExpandedDevices(newExpanded);
                        }}
                        className="sm:h-7 sm:w-7 h-6 w-6 p-0 shrink-0 hover:bg-primary/10 rounded transition-all"
                        title={isExpanded ? "Hide details" : "Show details"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="sm:h-3.5 sm:w-3.5 h-3 w-3" />
                        ) : (
                          <ChevronDown className="sm:h-3.5 sm:w-3.5 h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Metadata Section */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-primary/10 space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 gap-2 text-[10px]">
                        {/* Device ID */}
                        <div className="flex items-start justify-between gap-2 bg-muted/30 p-2 rounded">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Info className="h-3 w-3 shrink-0" />
                            <span className="font-medium">Device ID:</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <code className="text-foreground font-mono text-[9px] break-all">
                              {d.device_id}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(d.device_id);
                              }}
                              className="h-4 w-4 p-0 hover:bg-primary/10"
                              title="Copy Device ID"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Last Seen */}
                        <div className="flex items-start justify-between gap-2 bg-muted/30 p-2 rounded">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="font-medium">Last Seen:</span>
                          </div>
                          <span className="text-foreground text-right">
                            {new Date(d.last_seen).toLocaleString()}
                          </span>
                        </div>

                        {/* Joined At */}
                        <div className="flex items-start justify-between gap-2 bg-muted/30 p-2 rounded">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="font-medium">Joined:</span>
                          </div>
                          <span className="text-foreground text-right">
                            {new Date(d.created_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Permissions */}
                        <div className="flex items-start justify-between gap-2 bg-muted/30 p-2 rounded">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UserCheck className="h-3 w-3 shrink-0" />
                            <span className="font-medium">Permissions:</span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            <span
                              className={`px-1.5 py-0.5 rounded ${d.can_view !== false ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                            >
                              View: {d.can_view !== false ? "✓" : "✗"}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded ${d.can_export !== false ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                            >
                              Export: {d.can_export !== false ? "✓" : "✗"}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded ${d.can_delete_items !== false ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                            >
                              Delete: {d.can_delete_items !== false ? "✓" : "✗"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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
    </div>
  );
}
