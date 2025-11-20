"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { subscribeToGlobalRefresh } from "@/lib/globalRefresh";
import { triggerGlobalRefresh } from "@/lib/globalRefresh";
import { getOrCreateDeviceId } from "@/lib/device";
import {
  generateSessionKey,
  decryptData,
  decryptDeviceName,
  createEncryptedFileDownloadUrl,
  decryptTimestamp,
  decryptDisplayId,
} from "@/lib/encryption";
import {
  Check,
  Copy,
  Download,
  FileText,
  Code,
  Image as ImageIcon,
  Trash2,
  ShieldCheck,
  Terminal,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import MaskedOverlay from "@/components/ui/masked-overlay";
import FilePreview from "./file-preview";
import { marked } from "marked";
import DOMPurify from "dompurify";
import LeavingCountdown from "./leaving-countdown";
import { useHistoryControls } from "./history-controls-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Item = {
  id: string;
  session_code: string;
  kind: "text" | "code" | "file";
  content_encrypted?: string | null;
  content?: string | null; // decrypted content for display
  file_url: string | null;
  // New encrypted file fields
  file_data_encrypted?: string | null;
  file_name_encrypted?: string | null;
  file_mime_type_encrypted?: string | null;
  file_size_encrypted?: string | null;
  // Enhanced encryption fields
  created_at_encrypted?: string | null;
  updated_at_encrypted?: string | null;
  display_id_encrypted?: string | null;
  // Decrypted fields for display
  file_name?: string;
  file_mime_type?: string;
  file_size?: number;
  file_download_url?: string;
  display_id?: string;
  display_created_at?: Date;
  display_updated_at?: Date;
  created_at: string; // Server timestamp for sorting
  device_id?: string;
  device_name?: string; // decrypted device name for display
};

type DeviceInfo = {
  device_id: string;
  device_name_encrypted?: string;
  device_name?: string;
};

export default function ItemsList({ code }: { code: string }) {
  const supabase = getSupabaseBrowserWithCode(code);
  const controls = useHistoryControls();
  const { openBottomSheet } = controls;

  const [items, setItems] = useState<Item[]>([]);
  const [canView, setCanView] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [canExport, setCanExport] = useState(true);
  const [exportEnabled, setExportEnabled] = useState(true);
  const [canDeleteItems, setCanDeleteItems] = useState(true);
  const [allowItemDeletion, setAllowItemDeletion] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [devices, setDevices] = useState<Map<string, DeviceInfo>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5000);

  // Leaving state
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveReason, setLeaveReason] = useState<
    "kicked" | "left" | "host-left"
  >("kicked");

  // Initialize device ID on client side
  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // Initialize session encryption key
  useEffect(() => {
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  // Publish state to context for control bar
  useEffect(() => {
    controls.setConnectionStatus(connectionStatus);
    controls.setItemsCount(items.length);
    controls.setExportEnabled(exportEnabled);
    controls.setCanExport(canExport);
    controls.setIsHost(isHost);
    controls.setAutoRefreshEnabled(autoRefreshEnabled);
    controls.setIsRefreshing(isRefreshing);
    controls.setAutoRefreshInterval(autoRefreshInterval);
    controls.setDeletionEnabled(allowItemDeletion && canDeleteItems);
  }, [
    connectionStatus,
    items.length,
    exportEnabled,
    canExport,
    isHost,
    autoRefreshEnabled,
    isRefreshing,
    autoRefreshInterval,
    allowItemDeletion,
    canDeleteItems,
    controls,
  ]);

  // Listen for control bar events
  useEffect(() => {
    const handleManualRefresh = () => {
      fetchAndDecryptItems(true);
    };

    const handleToggleAutoRefresh = () => {
      setAutoRefreshEnabled((prev) => !prev);
    };

    const handleCycleTimeInterval = () => {
      setAutoRefreshInterval((prev) => {
        const intervals = [3000, 5000, 10000, 15000, 30000, 60000];
        const currentIndex = intervals.indexOf(prev);
        const nextIndex = (currentIndex + 1) % intervals.length;
        return intervals[nextIndex];
      });
    };

    window.addEventListener("manual-refresh", handleManualRefresh);
    window.addEventListener("toggle-auto-refresh", handleToggleAutoRefresh);
    window.addEventListener("cycle-time-interval", handleCycleTimeInterval);

    return () => {
      window.removeEventListener("manual-refresh", handleManualRefresh);
      window.removeEventListener(
        "toggle-auto-refresh",
        handleToggleAutoRefresh
      );
      window.removeEventListener(
        "cycle-time-interval",
        handleCycleTimeInterval
      );
    };
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefreshEnabled || !supabase || !sessionKey) return;

    const refreshTimer = setInterval(() => {
      fetchAndDecryptItems(true);
    }, autoRefreshInterval);

    return () => clearInterval(refreshTimer);
  }, [autoRefreshEnabled, autoRefreshInterval, supabase, sessionKey]);

  // Fetch and decrypt items logic
  const fetchAndDecryptItems = async (showLoading = false) => {
    if (!supabase || !sessionKey) return;

    try {
      if (showLoading) setIsRefreshing(true);
      setError(null);
      setConnectionStatus("connecting");

      // First fetch all devices for this session to build device name map
      const { data: devicesData } = await supabase
        .from("devices")
        .select("device_id, device_name_encrypted")
        .eq("session_code", code);

      // Check if current device still exists in the session
      const currentDeviceExists = devicesData?.some(
        (d) => d.device_id === deviceId
      );

      if (!currentDeviceExists) {
        // Device has been removed/kicked - trigger immediate redirect
        localStorage.removeItem(`pp-host-${code}`);
        localStorage.removeItem(`pp-joined-${code}`);
        setLeaveReason("kicked");
        setIsLeaving(true);
        return;
      }

      // Build device name map with decryption
      const deviceMap = new Map<string, DeviceInfo>();
      if (devicesData) {
        for (const device of devicesData) {
          let deviceName = "Anonymous Device";
          if (device.device_name_encrypted) {
            try {
              deviceName = await decryptDeviceName(
                device.device_name_encrypted,
                sessionKey
              );
            } catch (e) {
              console.warn(
                "Failed to decrypt device name for",
                device.device_id
              );
            }
          }
          deviceMap.set(device.device_id, {
            device_id: device.device_id,
            device_name_encrypted: device.device_name_encrypted,
            device_name: deviceName,
          });
        }
      }
      setDevices(deviceMap);

      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("session_code", code)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Fetch error:", error);
        setError(error.message);
        setConnectionStatus("disconnected");
        return;
      }

      if (!data) {
        setConnectionStatus("connected");
        return;
      }

      // Decrypt content and resolve device names for display
      const decryptedItems = await Promise.all(
        data.map(async (item: any) => {
          let content = null;
          if (item.content_encrypted) {
            try {
              content = await decryptData(item.content_encrypted, sessionKey);
            } catch (e) {
              console.warn("Failed to decrypt item content:", e);
              content = "[Encrypted Content - Unable to Decrypt]";
            }
          }

          // Decrypt file metadata if it's a file
          let fileName = null;
          let fileMimeType = null;
          let fileSize = null;
          let fileDownloadUrl = null;

          if (item.kind === "file" && item.file_data_encrypted) {
            try {
              // Decrypt file metadata
              if (item.file_name_encrypted) {
                fileName = await decryptData(
                  item.file_name_encrypted,
                  sessionKey
                );
              }
              if (item.file_mime_type_encrypted) {
                fileMimeType = await decryptData(
                  item.file_mime_type_encrypted,
                  sessionKey
                );
              }
              if (item.file_size_encrypted) {
                const sizeStr = await decryptData(
                  item.file_size_encrypted,
                  sessionKey
                );
                fileSize = parseInt(sizeStr, 10);
              }

              // Create download URL for encrypted file
              if (fileMimeType) {
                fileDownloadUrl = await createEncryptedFileDownloadUrl(
                  item.file_data_encrypted,
                  sessionKey,
                  fileMimeType,
                  fileName || undefined
                );
              }
            } catch (e) {
              console.warn("Failed to decrypt file metadata:", e);
              fileName = "[Encrypted File]";
            }
          }

          // Enhanced decryption: decrypt timestamps and display ID
          let displayId = null;
          let displayCreatedAt = null;
          let displayUpdatedAt = null;

          try {
            if (item.display_id_encrypted) {
              displayId = await decryptDisplayId(
                item.display_id_encrypted,
                sessionKey
              );
            }
            if (item.created_at_encrypted) {
              displayCreatedAt = await decryptTimestamp(
                item.created_at_encrypted,
                sessionKey
              );
            }
            if (item.updated_at_encrypted) {
              displayUpdatedAt = await decryptTimestamp(
                item.updated_at_encrypted,
                sessionKey
              );
            }
          } catch (e) {
            console.warn("Failed to decrypt enhanced metadata:", e);
          }

          // Get device name from device map
          let deviceName = "Anonymous Device";
          const deviceInfo = deviceMap.get(item.device_id);
          if (deviceInfo?.device_name) {
            deviceName = deviceInfo.device_name;
          }

          return {
            ...item,
            content,
            device_name: deviceName,
            file_name: fileName,
            file_mime_type: fileMimeType,
            file_size: fileSize,
            file_download_url: fileDownloadUrl,
            display_id: displayId,
            display_created_at: displayCreatedAt,
            display_updated_at: displayUpdatedAt,
          };
        })
      );

      setItems(decryptedItems);
      setConnectionStatus("connected");
    } catch (e: any) {
      console.error("Error fetching items:", e);
      setError(e?.message || "Failed to fetch items");
      setConnectionStatus("disconnected");
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  // Fetch and decrypt device information
  useEffect(() => {
    if (!supabase || !sessionKey) return;

    const fetchDevices = async () => {
      const { data } = await supabase
        .from("devices")
        .select("device_id, device_name_encrypted")
        .eq("session_code", code);

      if (data) {
        const deviceMap = new Map<string, DeviceInfo>();
        await Promise.all(
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
            deviceMap.set(device.device_id, {
              device_id: device.device_id,
              device_name_encrypted: device.device_name_encrypted,
              device_name: deviceName,
            });
          })
        );
        setDevices(deviceMap);
      }
    };

    fetchDevices();
  }, [supabase, sessionKey, code]);

  // Check view permissions with realtime enforcement
  useEffect(() => {
    if (!supabase || !deviceId) return;

    const checkViewPermission = async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("can_view, is_frozen, can_export, can_delete_items, is_host")
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .single();

      if (data) {
        setCanView(data.can_view !== false);
        setIsFrozen(data.is_frozen === true);
        setCanExport(data.can_export !== false);
        // Default to true if column doesn't exist yet
        setCanDeleteItems(data.can_delete_items !== false);
        setIsHost(data.is_host === true);
      } else if (error) {
        console.warn("Could not fetch device permissions, using defaults:", error);
        setCanDeleteItems(true);
      }

      // Fetch session settings
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("export_enabled, allow_item_deletion")
        .eq("code", code)
        .single();

      if (sessionData) {
        setExportEnabled(sessionData.export_enabled !== false);
        setAllowItemDeletion(sessionData.allow_item_deletion !== false);
      } else if (sessionError) {
        console.warn("Could not fetch session settings, using defaults:", sessionError);
        setAllowItemDeletion(true);
      }
    };

    checkViewPermission();

    // Subscribe to view permission changes
    const viewChannel = supabase
      .channel(`view-permissions-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        (payload) => {
          if (payload.new && payload.new.device_id === deviceId) {
            setCanView(payload.new.can_view !== false);
            setIsFrozen(payload.new.is_frozen === true);
            setCanExport(payload.new.can_export !== false);
            setCanDeleteItems(payload.new.can_delete_items !== false);
            setIsHost(payload.new.is_host === true);
            fetchAndDecryptItems();
            try {
              triggerGlobalRefresh();
            } catch {}
          }
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
          if (payload.new) {
            setExportEnabled(payload.new.export_enabled !== false);
            setAllowItemDeletion(payload.new.allow_item_deletion !== false);
            try {
              triggerGlobalRefresh();
            } catch {}
          }
        }
      )
      .on("broadcast", { event: "export_toggle" }, (payload) => {
        setExportEnabled(payload.payload.export_enabled !== false);
        try {
          triggerGlobalRefresh();
        } catch {}
      })
      .on("broadcast", { event: "deletion_toggle" }, (payload) => {
        setAllowItemDeletion(payload.payload.allow_item_deletion !== false);
        try {
          triggerGlobalRefresh();
        } catch {}
      })
      .on("broadcast", { event: "permission_changed" }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          setCanView(payload.payload.can_view !== false);
          setIsFrozen(payload.payload.is_frozen === true);
          setCanDeleteItems(payload.payload.can_delete_items !== false);
          setCanExport(payload.payload.can_export !== false);
          try {
            triggerGlobalRefresh();
          } catch {}
        }
      })
      .on("broadcast", { event: "device_kicked" }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          localStorage.removeItem(`pp-host-${code}`);
          localStorage.removeItem(`pp-joined-${code}`);
          setLeaveReason("kicked");
          setIsLeaving(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(viewChannel);
    };
  }, [supabase, code, deviceId]);

  // Subscribe to items and devices changes
  useEffect(() => {
    if (!supabase || !sessionKey) return;
    
    const unsubscribeRefresh = subscribeToGlobalRefresh(() => {
      fetchAndDecryptItems();
    });

    // Subscribe to device changes
    const devicesChannel = supabase
      .channel(`devices-${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        async (payload) => {
          const newDevice = payload.new as any;
          if (newDevice && newDevice.device_id) {
            let deviceName = "Anonymous Device";
            if (newDevice.device_name_encrypted) {
              try {
                deviceName = await decryptDeviceName(
                  newDevice.device_name_encrypted,
                  sessionKey
                );
              } catch (e) {
                console.warn("Failed to decrypt device name:", e);
              }
            }
            setDevices((prev) => {
              const newMap = new Map(prev);
              newMap.set(newDevice.device_id, {
                device_id: newDevice.device_id,
                device_name_encrypted: newDevice.device_name_encrypted,
                device_name: deviceName,
              });
              return newMap;
            });
          }
        }
      )
      .subscribe();

    // Subscribe to items changes
    const itemsChannel = supabase
      .channel(`items-realtime-${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `session_code=eq.${code}`,
        },
        () => {
          // Just trigger a refresh for simplicity
          try {
            triggerGlobalRefresh();
          } catch {}
        }
      )
      .subscribe();

    return () => {
      if (unsubscribeRefresh) unsubscribeRefresh();
      supabase.removeChannel(devicesChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [supabase, sessionKey, code]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setCopiedItems((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderMarkdown = (content: string) => {
    const html = marked(content, { async: false }) as string;
    return { __html: DOMPurify.sanitize(html) };
  };

  const getContentIcon = (kind: string, mimeType?: string) => {
    if (kind === "file") {
      if (mimeType?.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
      return <FileText className="h-4 w-4" />;
    }
    if (kind === "code") return <Code className="h-4 w-4" />;
    return <Terminal className="h-4 w-4" />;
  };

  if (!supabase) return null;

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Masked Overlay for hidden/frozen states */}
      {(!canView || isFrozen) && (
        <MaskedOverlay variant={!canView ? "hidden" : "frozen"} />
      )}

      {/* Leaving Countdown */}
      {isLeaving && <LeavingCountdown reason={leaveReason} />}

      {/* Terminal Header - Fixed/Sticky */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-300 dark:border-zinc-800 text-gray-700 dark:text-zinc-400 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3" />
          <span className="font-medium">session@{code}:~/history</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{items.length} items</span>
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {/* Terminal Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900/50 dark:to-slate-950/50 text-sm text-gray-900 dark:text-zinc-300 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {items.length === 0 ? (
          <div className="text-gray-500 dark:text-zinc-500 italic p-8 text-center flex flex-col items-center justify-center h-full">
            <Terminal className="h-8 w-8 mb-2 opacity-20" />
            <p>No history items found.</p>
            <p className="text-xs mt-1">Waiting for input...</p>
          </div>
        ) : (
          items.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const isCopied = copiedItems.has(item.id);
            const timestamp = item.display_created_at
              ? item.display_created_at.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : new Date(item.created_at).toLocaleTimeString();


            return (
              <div
                key={item.id}
                className={`group relative border transition-all duration-200 ${
                  isExpanded 
                    ? "border-gray-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/40 backdrop-blur-sm pb-3 shadow-md dark:shadow-none" 
                    : "border-gray-200/50 dark:border-zinc-800/30 bg-white/50 dark:bg-zinc-900/20 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-zinc-900/30"
                }`}
              >
                <div className="flex items-center gap-2 p-2 px-3 h-10">
                  {/* Expand Toggle */}
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 shrink-0 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {/* Metadata */}
                  <span className="text-gray-600 dark:text-zinc-500 text-[10px] shrink-0 font-medium">
                    {timestamp}
                  </span>
                  <span className="text-blue-700 dark:text-blue-400 font-semibold text-xs shrink-0">
                    {item.device_name || "unknown"}
                  </span>

                  {/* Collapsed Content Preview */}
                  {!isExpanded && (
                    <>
                      <span className="text-gray-500 dark:text-zinc-600 text-xs shrink-0">:</span>
                      <div className="flex-1 min-w-0 truncate text-gray-900 dark:text-zinc-300 text-sm font-medium">
                        {item.kind === "file" ? (
                          <span className="flex items-center gap-1.5">
                            {getContentIcon("file", item.file_mime_type)}
                            {item.file_name}
                          </span>
                        ) : (
                          item.content?.replace(/\n/g, " ")
                        )}
                      </div>
                    </>
                  )}

                  {/* Actions - Pushed to right */}
                  <div
                    className={`flex items-center gap-1 ml-auto shrink-0 transition-opacity duration-200 ${
                      isExpanded || isCopied
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-200/80 dark:hover:bg-zinc-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(item.content || "", item.id);
                      }}
                      title="Copy content"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>

                    {item.kind === "file" && item.file_download_url && (
                      <a
                        href={item.file_download_url}
                        download={item.file_name}
                        className="inline-flex items-center justify-center h-6 w-6 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 rounded-md"
                        title="Download file"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-500 hover:text-green-400 hover:bg-zinc-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        openBottomSheet("verification", {
                          isItemVerification: true,
                          itemType: item.kind,
                          sessionKey,
                        });
                      }}
                      title="Verify Integrity"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </Button>

                    {allowItemDeletion && canDeleteItems && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          openBottomSheet("delete-item", { itemId: item.id });
                        }}
                        title="Delete item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-3 pl-9 mt-2">
                    <div className="bg-zinc-900/30 rounded border border-zinc-800">
                      <div className="max-h-96 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700">
                        {item.kind === "text" && (
                          <div className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap break-words">
                            {item.content}
                          </div>
                        )}
                        {item.kind === "code" && (
                          <pre className="text-xs text-zinc-200 whitespace-pre-wrap break-words font-mono leading-relaxed">
                            <code>{item.content}</code>
                          </pre>
                        )}
                        {item.kind === "file" && (
                          <div className="flex items-start gap-4 p-3 bg-zinc-900/50 rounded border border-zinc-800">
                            <div className="p-3 bg-zinc-950 rounded text-zinc-400">
                              {getContentIcon("file", item.file_mime_type)}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-zinc-200 mb-1">
                                {item.file_name}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {Math.round((item.file_size || 0) / 1024)} KB • {item.file_mime_type}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
