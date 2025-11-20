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
  Crown,
  Snowflake,
  Play,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  UserCheck,
  Clock,
  Loader2,
  Download,
  Ban,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import MaskedOverlay from "@/components/ui/masked-overlay";
import { useHistoryControls } from "./history-controls-context";

type Device = {
  id: string;
  device_id: string;
  device_name_encrypted: string;
  device_name?: string;
  is_host: boolean;
  can_view: boolean;
  is_frozen: boolean;
  can_export: boolean;
  can_delete_items: boolean;
  last_seen: string;
  created_at: string;
};

export default function DevicesPanel({ code }: { code: string }) {
  const { 
    openBottomSheet, 
    exportEnabled, 
    setExportEnabled, 
    deletionEnabled, 
    setDeletionEnabled,
    setCanExport,
  } = useHistoryControls();
  
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
  const [isHost, setIsHost] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null
  );
  const [redirectReason, setRedirectReason] = useState<string>("");

  // Initialize
  useEffect(() => {
    const id = getOrCreateDeviceId();
    setSelfId(id);
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  // Fetch devices and session settings
  const fetchDevices = async () => {
    if (!supabase || !sessionKey) return;

    try {
      // Fetch session settings
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("export_enabled, allow_item_deletion")
        .eq("code", code)
        .single();

      if (sessionData) {
        setExportEnabled(sessionData.export_enabled ?? true);
        setDeletionEnabled(sessionData.allow_item_deletion ?? true);
      }

      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("session_code", code)
        .order("is_host", { ascending: false })
        .order("last_seen", { ascending: false });

      if (error) throw error;

      if (data) {
        const decryptedDevices = await Promise.all(
          data.map(async (d) => {
            let deviceName = "Anonymous Device";
            if (d.device_name_encrypted) {
              try {
                deviceName = await decryptDeviceName(
                  d.device_name_encrypted,
                  sessionKey
                );
              } catch (e) {
                console.warn("Failed to decrypt device name:", e);
              }
            }
            return { ...d, device_name: deviceName };
          })
        );
        setDevices(decryptedDevices);

        const me = decryptedDevices.find((d) => d.device_id === selfId);
        if (me) {
          setIsHost(me.is_host);
        } else {
          const { data: myData } = await supabase
            .from("devices")
            .select("device_id")
            .eq("session_code", code)
            .eq("device_id", selfId)
            .single();
            
          if (!myData) {
             startRedirectCountdown("You have been removed from the session.");
          }
        }
      }
    } catch (e: any) {
      console.error("Error fetching devices:", e);
      setError(e.message);
    }
  };

  // Initial fetch and subscriptions
  useEffect(() => {
    if (!supabase) return;

    if (sessionKey) {
      fetchDevices();
    }

    const channel = supabase
      .channel(`devices-panel-${code}`)
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `code=eq.${code}`,
        },
        (payload) => {
          // Real-time sync for export/deletion toggles
          if (payload.new) {
            const newData = payload.new as any;
            if ('export_enabled' in newData) {
              setExportEnabled(newData.export_enabled);
            }
            if ('allow_item_deletion' in newData) {
              setDeletionEnabled(newData.allow_item_deletion);
            }
          }
        }
      )
      .on(
        "broadcast",
        { event: "export_toggle" },
        (payload: any) => {
          setExportEnabled(payload.payload.export_enabled);
        }
      )
      .on(
        "broadcast",
        { event: "deletion_toggle" },
        (payload: any) => {
          setDeletionEnabled(payload.payload.allow_item_deletion);
        }
      )
      .subscribe();
      
    const unsubscribeGlobal = subscribeToGlobalRefresh(() => {
        fetchDevices();
    });

    return () => {
      supabase.removeChannel(channel);
      unsubscribeGlobal();
    };
  }, [sessionKey, code, supabase]);

  const startRedirectCountdown = (reason: string) => {
    setRedirectReason(reason);
    setRedirectCountdown(5);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          window.location.href = "/";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const kick = async (targetDeviceId: string) => {
    if (!supabase || !isHost) return;
    setLoading((prev) => ({ ...prev, [targetDeviceId]: true }));

    try {
      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", targetDeviceId);

      if (error) throw error;
      
      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "device_kicked",
        payload: { device_id: targetDeviceId },
      });
      
      setDevices((prev) => prev.filter((d) => d.device_id !== targetDeviceId));
      triggerGlobalRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading((prev) => ({ ...prev, [targetDeviceId]: false }));
    }
  };

  const toggleFreeze = async (targetDeviceId: string, currentStatus: boolean) => {
    if (!supabase || !isHost) return;
    
    // Optimistic update
    setDevices(prev => prev.map(d => 
      d.device_id === targetDeviceId ? { ...d, is_frozen: !currentStatus } : d
    ));
    setLoading((prev) => ({ ...prev, [`freeze-${targetDeviceId}`]: true }));

    try {
      const { error } = await supabase
        .from("devices")
        .update({ is_frozen: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", targetDeviceId);

      if (error) {
        // Revert on error
        setDevices(prev => prev.map(d => 
          d.device_id === targetDeviceId ? { ...d, is_frozen: currentStatus } : d
        ));
        throw error;
      }
      
      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: targetDeviceId, is_frozen: !currentStatus },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading((prev) => ({ ...prev, [`freeze-${targetDeviceId}`]: false }));
    }
  };

  const toggleView = async (targetDeviceId: string, currentStatus: boolean) => {
    if (!supabase || !isHost) return;
    
    // Optimistic update
    setDevices(prev => prev.map(d => 
      d.device_id === targetDeviceId ? { ...d, can_view: !currentStatus } : d
    ));
    setLoading((prev) => ({ ...prev, [`view-${targetDeviceId}`]: true }));

    try {
      const { error } = await supabase
        .from("devices")
        .update({ can_view: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", targetDeviceId);

      if (error) {
        // Revert on error
        setDevices(prev => prev.map(d => 
          d.device_id === targetDeviceId ? { ...d, can_view: currentStatus } : d
        ));
        throw error;
      }

      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: targetDeviceId, can_view: !currentStatus },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading((prev) => ({ ...prev, [`view-${targetDeviceId}`]: false }));
    }
  };

  const toggleExport = async (targetDeviceId: string, currentStatus: boolean) => {
    if (!supabase || !isHost) return;
    
    // Optimistic update
    setDevices(prev => prev.map(d => 
      d.device_id === targetDeviceId ? { ...d, can_export: !currentStatus } : d
    ));
    setLoading((prev) => ({ ...prev, [`export-${targetDeviceId}`]: true }));

    try {
      const { error } = await supabase
        .from("devices")
        .update({ can_export: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", targetDeviceId);

      if (error) {
        // Revert on error
        setDevices(prev => prev.map(d => 
          d.device_id === targetDeviceId ? { ...d, can_export: currentStatus } : d
        ));
        throw error;
      }

      // Update context if it's the current device
      if (targetDeviceId === selfId) {
        setCanExport(!currentStatus);
      }

      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: targetDeviceId, can_export: !currentStatus },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading((prev) => ({ ...prev, [`export-${targetDeviceId}`]: false }));
    }
  };

  const toggleDeleteItems = async (targetDeviceId: string, currentStatus: boolean) => {
    if (!supabase || !isHost) return;
    
    // Optimistic update
    setDevices(prev => prev.map(d => 
      d.device_id === targetDeviceId ? { ...d, can_delete_items: !currentStatus } : d
    ));
    setLoading((prev) => ({ ...prev, [`delete-${targetDeviceId}`]: true }));

    try {
      const { error } = await supabase
        .from("devices")
        .update({ can_delete_items: !currentStatus })
        .eq("session_code", code)
        .eq("device_id", targetDeviceId);

      if (error) {
        // Revert on error
        setDevices(prev => prev.map(d => 
          d.device_id === targetDeviceId ? { ...d, can_delete_items: currentStatus } : d
        ));
        throw error;
      }

      await supabase.channel(`view-permissions-${code}`).send({
        type: "broadcast",
        event: "permission_changed",
        payload: { device_id: targetDeviceId, can_delete_items: !currentStatus },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading((prev) => ({ ...prev, [`delete-${targetDeviceId}`]: false }));
    }
  };

  const leaveSession = async (deviceId: string, isHostDevice: boolean) => {
    if (!supabase) return;
    
    if (isHostDevice) {
      const otherDevices = devices.filter(d => d.device_id !== deviceId);
      if (otherDevices.length > 0) {
        setShowTransferHost(true);
        return;
      }
    }

    setLoading((prev) => ({ ...prev, [`leave-${deviceId}`]: true }));
    try {
      await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", deviceId);
        
      localStorage.removeItem(`pp-host-${code}`);
      localStorage.removeItem(`pp-joined-${code}`);
      window.location.href = "/";
    } catch (e: any) {
      setError(e.message);
      setLoading((prev) => ({ ...prev, [`leave-${deviceId}`]: false }));
    }
  };

  const transferHostAndLeave = async () => {
    if (!supabase || !selectedNewHost) return;
    setLoading((prev) => ({ ...prev, transferHost: true }));

    try {
      const { error: promoteError } = await supabase
        .from("devices")
        .update({ is_host: true })
        .eq("session_code", code)
        .eq("device_id", selectedNewHost);

      if (promoteError) throw promoteError;

      const { error: leaveError } = await supabase
        .from("devices")
        .delete()
        .eq("session_code", code)
        .eq("device_id", selfId);

      if (leaveError) throw leaveError;

      localStorage.removeItem(`pp-host-${code}`);
      localStorage.removeItem(`pp-joined-${code}`);
      window.location.href = "/";
    } catch (e: any) {
      setError(e.message);
      setLoading((prev) => ({ ...prev, transferHost: false }));
    }
  };

  const toggleGlobalExport = async () => {
    if (!supabase || !isHost) return;

    try {
      const newStatus = !exportEnabled;
      // Optimistic update for immediate feedback
      setExportEnabled(newStatus);
      
      const { error } = await supabase
        .from("sessions")
        .update({ export_enabled: newStatus })
        .eq("code", code);

      if (error) {
        // Revert on error
        setExportEnabled(!newStatus);
        throw error;
      }

      await supabase.channel(`sessions-${code}`).send({
        type: "broadcast",
        event: "export_toggle",
        payload: { export_enabled: newStatus },
      });
    } catch (e: any) {
      console.error("Toggle export error:", e);
      setError(e.message || "Failed to toggle export");
    }
  };

  const toggleItemDeletion = async () => {
    if (!supabase || !isHost) return;

    try {
      const newStatus = !deletionEnabled;
      // Optimistic update for immediate feedback
      setDeletionEnabled(newStatus);
      
      const { error } = await supabase
        .from("sessions")
        .update({ allow_item_deletion: newStatus })
        .eq("code", code);

      if (error) {
        // Revert on error
        setDeletionEnabled(!newStatus);
        throw error;
      }

      await supabase.channel(`sessions-${code}`).send({
        type: "broadcast",
        event: "deletion_toggle",
        payload: { allow_item_deletion: newStatus },
      });
    } catch (e: any) {
      console.error("Toggle deletion error:", e);
      setError(e.message || "Failed to toggle deletion");
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (name.includes("phone") || name.includes("mobile") || name.includes("android") || name.includes("iphone")) {
      return <Smartphone className="h-4 w-4" />;
    } else if (name.includes("laptop") || name.includes("macbook")) {
      return <Laptop className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const formatLastSeen = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (!supabase) return null;

  return (
    <div className="w-full h-full flex flex-col">
      {(() => {
        const local = devices.find((dd) => dd.device_id === selfId);
        if (local && local.can_view === false) {
          return <MaskedOverlay variant="hidden" />;
        }
        return null;
      })()}

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

        <div className="px-3 py-2 space-y-2">
          {/* Verification Button */}
          <button
            onClick={() => openBottomSheet("verification", { sessionKey })}
            className="w-full flex items-center justify-between bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 px-4 py-2.5 rounded border border-green-500/20 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-medium">Session Verified</span>
            </div>
            <span className="text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
              View Details
            </span>
          </button>

          {/* Host Controls */}
          {isHost && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
                <span>Host Controls</span>
              </div>
              
              {/* Global Permissions Grid */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleGlobalExport}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded border transition-all ${
                    exportEnabled
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                      : "bg-slate-100 dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  <Download className="h-4 w-4" />
                  <span className="text-[11px] font-medium">
                    {exportEnabled ? "Export ON" : "Export OFF"}
                  </span>
                </button>

                <button
                  onClick={toggleItemDeletion}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded border transition-all ${
                    deletionEnabled
                      ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                      : "bg-slate-100 dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-[11px] font-medium">
                    {deletionEnabled ? "Delete ON" : "Delete OFF"}
                  </span>
                </button>
              </div>

              {/* Purge Session Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => openBottomSheet("kill-session")}
                className="w-full gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-500/10 hover:border-red-500/50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Purge Entire Session</span>
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 px-3 py-2">{" "}
          {devices.map((d) => {
            const timeSinceLastSeen =
              new Date().getTime() - new Date(d.last_seen).getTime();
            const isOnline = timeSinceLastSeen < 60000;
            const isExpanded = expandedDevices.has(d.device_id);

            return (
              <div
                key={d.id}
                className={`border rounded transition-all ${
                  isExpanded 
                    ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/30 shadow-sm dark:shadow-none" 
                    : "border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/10 hover:bg-gray-100 dark:hover:bg-zinc-900/20"
                }`}
              >
                <div className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="text-gray-600 dark:text-zinc-400">
                        {getDeviceIcon(d.device_name || "")}
                      </div>
                      <div
                        className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border ${
                          isOnline 
                            ? "bg-green-500 border-white dark:border-zinc-900" 
                            : "bg-gray-400 dark:bg-zinc-600 border-white dark:border-zinc-900"
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate text-gray-900 dark:text-zinc-100">
                        {d.device_name || `Device-${d.device_id.slice(0, 6)}`}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">{" "}
                        {d.device_id === selfId && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                            YOU
                          </span>
                        )}
                        {d.is_host && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Crown className="h-2.5 w-2.5" />
                            HOST
                          </span>
                        )}
                        {d.is_frozen && (
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                            FROZEN
                          </span>
                        )}
                        {d.can_view === false && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                            HIDDEN
                          </span>
                        )}
                        {!isOnline && (
                          <span className="text-[10px] text-zinc-500">
                            {formatLastSeen(d.last_seen)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {d.device_id === selfId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => leaveSession(d.device_id, d.is_host || false)}
                          disabled={loading[`leave-${d.device_id}`]}
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          {loading[`leave-${d.device_id}`] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <LogOut className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Leave</span>
                            </>
                          )}
                        </Button>
                      ) : isHost ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => kick(d.device_id)}
                          disabled={loading[d.device_id]}
                          className="h-7 px-2 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
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
                      ) : null}

                      {isHost && d.device_id !== selfId && (
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
                          className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && isHost && d.device_id !== selfId && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => toggleFreeze(d.device_id, d.is_frozen || false)}
                          disabled={loading[`freeze-${d.device_id}`]}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-xs transition-colors ${
                            d.is_frozen
                              ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {loading[`freeze-${d.device_id}`] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : d.is_frozen ? (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              Unfreeze
                            </>
                          ) : (
                            <>
                              <Snowflake className="h-3.5 w-3.5" />
                              Freeze
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => toggleView(d.device_id, d.can_view !== false)}
                          disabled={loading[`view-${d.device_id}`]}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-xs transition-colors ${
                            d.can_view === false
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {loading[`view-${d.device_id}`] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : d.can_view === false ? (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Show
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              Hide
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => toggleExport(d.device_id, d.can_export !== false)}
                          disabled={loading[`export-${d.device_id}`]}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-xs transition-colors ${
                            d.can_export === false
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {loading[`export-${d.device_id}`] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : d.can_export === false ? (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              Allow Export
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" />
                              Block Export
                            </>
                          )}
                        </button>

                        <button
                          onClick={() =>
                            toggleDeleteItems(d.device_id, d.can_delete_items !== false)
                          }
                          disabled={loading[`delete-${d.device_id}`]}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-xs transition-colors ${
                            d.can_delete_items === false
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {loading[`delete-${d.device_id}`] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : d.can_delete_items === false ? (
                            <>
                              <Trash2 className="h-3.5 w-3.5" />
                              Allow Delete
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" />
                              Block Delete
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-[10px] text-zinc-500 space-y-1 pt-2">
                        <div>ID: {d.device_id.slice(0, 16)}...</div>
                        <div>Joined: {new Date(d.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {devices.length === 0 && !error && (
            <div className="text-center text-zinc-500 text-sm py-8">
              No devices connected yet.
            </div>
          )}
        </div>
      </div>

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
