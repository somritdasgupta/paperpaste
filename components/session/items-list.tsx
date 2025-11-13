"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { subscribeToGlobalRefresh } from "@/lib/globalRefresh";
import { triggerGlobalRefresh } from "@/lib/globalRefresh";
import { getOrCreateDeviceId } from "@/lib/device";
import { ErrorDialog } from "@/components/ui/error-dialog";
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
  ChevronDown,
  ChevronRight,
  Monitor,
  Smartphone,
  Laptop,
  FileText,
  Code,
  Image,
  RefreshCw,
  Pause,
  Play,
  Calendar,
  User,
  FileIcon,
  EyeOff,
  Timer,
  Trash2,
} from "lucide-react";
import MaskedOverlay from "@/components/ui/masked-overlay";
import FilePreview from "./file-preview";
import { marked } from "marked";
import DOMPurify from "dompurify";
import LeavingCountdown from "./leaving-countdown";
import ExportHistoryButton from "./export-history-button";

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
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5000); // 5 seconds default

  // Session dialog states
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  const [sessionKilledOpen, setSessionKilledOpen] = useState(false);
  const [killCountdown, setKillCountdown] = useState(5);

  // Leaving state
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveReason, setLeaveReason] = useState<
    "kicked" | "left" | "host-left"
  >("kicked");

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    itemId: string | null;
  }>({ open: false, itemId: null });

  // Initialize device ID on client side
  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // Initialize session encryption key
  useEffect(() => {
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  // Extract data fetching logic for reuse
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

  // Manual refresh function
  const handleManualRefresh = () => {
    fetchAndDecryptItems(true);
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
  const publicUrlFor = useMemo(() => {
    return (pathOrUrl: string) => {
      // If it's already a full URL, return as-is; else assume storage object path
      if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return url
        ? `${url}/storage/v1/object/public/paperpaste/${pathOrUrl}`
        : "#";
    };
  }, []);

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
        // If column doesn't exist, default to true (allow deletion)
        console.warn(
          "Could not fetch device permissions, using defaults:",
          error
        );
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
        // Default to true if column doesn't exist yet
        setAllowItemDeletion(sessionData.allow_item_deletion !== false);
      } else if (sessionError) {
        // If column doesn't exist, default to true (allow deletion)
        console.warn(
          "Could not fetch session settings, using defaults:",
          sessionError
        );
        setAllowItemDeletion(true);
      }
    };

    checkViewPermission();

    // Subscribe to view permission changes with broadcast for instant updates
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
      // Listen for instant export toggle broadcast
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
      // Listen for realtime broadcast events for instant permission changes
      .on("broadcast", { event: "permission_changed" }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          setCanView(payload.payload.can_view !== false);
          setIsFrozen(payload.payload.is_frozen === true);
          setCanDeleteItems(payload.payload.can_delete_items !== false);
          setCanExport(payload.payload.can_export !== false);
          // Trigger global refresh instead of immediately fetching
          // This respects the auto-refresh timer
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

  useEffect(() => {
    if (!supabase || !sessionKey) return;
    let active = true;
    // Initial data fetch
    fetchAndDecryptItems();

    // Subscribe to device changes for real-time device name updates
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
                console.warn(
                  "Failed to decrypt device name for",
                  newDevice.device_id
                );
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

    // Enhanced real-time subscription with immediate decryption
    const itemsChannel = supabase
      .channel(`items-realtime-${code}`, {
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
          table: "items",
          filter: `session_code=eq.${code}`,
        },
        async (payload) => {
          console.log("Real-time item change:", payload.eventType);

          if (payload.eventType === "INSERT" && payload.new) {
            const newItem = payload.new as any;
            let content = null;
            if (newItem.content_encrypted) {
              try {
                content = await decryptData(
                  newItem.content_encrypted,
                  sessionKey
                );
              } catch (e) {
                content = "[Encrypted Content - Unable to Decrypt]";
              }
            }

            // Decrypt file metadata if it's a file
            let fileName = null;
            let fileMimeType = null;
            let fileSize = null;
            let fileDownloadUrl = null;

            if (newItem.kind === "file" && newItem.file_data_encrypted) {
              try {
                if (newItem.file_name_encrypted) {
                  fileName = await decryptData(
                    newItem.file_name_encrypted,
                    sessionKey
                  );
                }
                if (newItem.file_mime_type_encrypted) {
                  fileMimeType = await decryptData(
                    newItem.file_mime_type_encrypted,
                    sessionKey
                  );
                }
                if (newItem.file_size_encrypted) {
                  const sizeStr = await decryptData(
                    newItem.file_size_encrypted,
                    sessionKey
                  );
                  fileSize = parseInt(sizeStr, 10);
                }
                if (fileMimeType) {
                  fileDownloadUrl = await createEncryptedFileDownloadUrl(
                    newItem.file_data_encrypted,
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

            // Get device name for the new item
            let deviceName = "Anonymous Device";
            const deviceInfo = devices.get(newItem.device_id);
            if (deviceInfo?.device_name) {
              deviceName = deviceInfo.device_name;
            }

            const decryptedItem = {
              ...newItem,
              content,
              device_name: deviceName,
              file_name: fileName,
              file_mime_type: fileMimeType,
              file_size: fileSize,
              file_download_url: fileDownloadUrl,
            };

            // Trigger global refresh instead of immediately updating
            // This respects the auto-refresh timer
            try {
              triggerGlobalRefresh();
            } catch {}
          } else {
            // For updates and deletes, refetch all to maintain consistency
            try {
              triggerGlobalRefresh();
            } catch {}
          }
        }
      )
      .subscribe((status) => {
        console.log("Items subscription status:", status);
      });
    const sessionChannel = supabase
      .channel(`sessions-${code}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "sessions",
          filter: `code=eq.${code}`,
        },
        () => {
          setSessionExpiredOpen(true);
        }
      )
      .subscribe();

    // Listen for session kill broadcasts
    const sessionKillChannel = supabase
      .channel(`session-kill-${code}`)
      .on("broadcast", { event: "session_killed" }, (payload) => {
        if (payload.payload.code === code) {
          setSessionKilledOpen(true);
          let count = 5;
          setKillCountdown(count);

          const countdownInterval = setInterval(() => {
            count--;
            if (count <= 0) {
              clearInterval(countdownInterval);
              window.location.href = "/";
              return;
            }
            setKillCountdown(count);
          }, 1000);
        }
      })
      .subscribe();

    // Subscribe to global refresh events instead of using a local timer.
    const unsubscribe = subscribeToGlobalRefresh(() => {
      if (active && autoRefreshRef.current) fetchAndDecryptItems();
    });

    return () => {
      active = false;
      unsubscribe();
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(devicesChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(sessionKillChannel);
    };
  }, [supabase, code, sessionKey]);

  // Separate useEffect to handle auto-refresh state changes without resubscribing to channels
  const autoRefreshRef = useRef(autoRefreshEnabled);

  useEffect(() => {
    autoRefreshRef.current = autoRefreshEnabled;
  }, [autoRefreshEnabled]);

  if (!supabase) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Supabase not configured. Add environment variables to start syncing.
      </div>
    );
  }

  if (!sessionKey) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <div>Loading encrypted session...</div>
        </div>
      </div>
    );
  }

  if (error && connectionStatus === "disconnected") {
    return (
      <div className="p-4 text-sm text-center">
        <div className="text-destructive mb-2 font-medium">
          Connection Error
        </div>
        <div className="text-muted-foreground text-xs">{error}</div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  // When view is revoked, keep rendering the UI but show a small badge and
  // an interaction-blocking overlay so layout doesn't jump and the app
  // appears smooth for other participants.

  const copyToClipboard = async (content: string, itemId?: string) => {
    try {
      await navigator.clipboard.writeText(content);
      if (itemId) {
        setCopiedItems((prev) => new Set(prev).add(itemId));
        setTimeout(() => {
          setCopiedItems((prev) => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
          });
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const deleteItem = async (itemId: string) => {
    if (!supabase) {
      console.warn("Delete not allowed - no supabase client");
      return;
    }

    // Show confirmation dialog
    setDeleteConfirm({ open: true, itemId });
  };

  const confirmDeleteItem = async () => {
    const itemId = deleteConfirm.itemId;
    if (!itemId || !supabase) return;

    // Close confirmation dialog
    setDeleteConfirm({ open: false, itemId: null });

    try {
      const { error } = await supabase.from("items").delete().eq("id", itemId);

      if (error) throw error;

      // Remove from local state immediately for instant feedback
      setItems((prev) => prev.filter((item) => item.id !== itemId));

      // Trigger refresh for other clients
      try {
        triggerGlobalRefresh();
      } catch {}
    } catch (err) {
      console.error("Failed to delete item:", err);
      setErrorDialog({
        open: true,
        title: "Delete Failed",
        message: "Failed to delete item. Please try again.",
      });
      // Optionally show error toast/notification
    }
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (
      name.includes("phone") ||
      name.includes("mobile") ||
      name.includes("android") ||
      name.includes("iphone")
    ) {
      return <Smartphone className="h-3 w-3" />;
    } else if (name.includes("laptop") || name.includes("macbook")) {
      return <Laptop className="h-3 w-3" />;
    }
    return <Monitor className="h-3 w-3" />;
  };

  const getContentIcon = (kind: string) => {
    switch (kind) {
      case "code":
        return <Code className="h-3 w-3" />;
      case "file":
        return <Download className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const renderMarkdown = (content: string) => {
    if (typeof window === "undefined") return content;
    try {
      const html = marked(content, {
        breaks: true,
        gfm: true,
      });
      return DOMPurify.sanitize(html as string);
    } catch (e) {
      return content;
    }
  };

  const shouldRenderAsMarkdown = (content: string) => {
    // Check if content has markdown-like patterns
    const markdownPatterns = [
      /^#{1,6}\s+/, // Headers
      /\*\*.*\*\*/, // Bold
      /\*.*\*/, // Italic
      /\[.*\]\(.*\)/, // Links
      /```[\s\S]*```/, // Code blocks
      /`.*`/, // Inline code
      /^[-*+]\s+/m, // Lists
      /^\d+\.\s+/m, // Numbered lists
      /^>\s+/m, // Blockquotes
    ];
    return markdownPatterns.some((pattern) => pattern.test(content));
  };

  // Toggle auto-refresh function
  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  // Cycle through time intervals: 3s -> 5s -> 10s -> 15s -> 30s -> 60s -> back to 3s
  const cycleTimeInterval = () => {
    const intervals = [3000, 5000, 10000, 15000, 30000, 60000];
    const currentIndex = intervals.indexOf(autoRefreshInterval);
    const nextIndex = (currentIndex + 1) % intervals.length;
    setAutoRefreshInterval(intervals[nextIndex]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileType = (mimeType: string) => {
    if (!mimeType) return "File";
    if (mimeType.startsWith("image/")) return "Image";
    if (mimeType.startsWith("video/")) return "Video";
    if (mimeType.startsWith("audio/")) return "Audio";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("text")) return "Text";
    if (mimeType.includes("document")) return "Document";
    if (mimeType.includes("spreadsheet")) return "Spreadsheet";
    if (mimeType.includes("presentation")) return "Presentation";
    return "File";
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType)
      return <FileText className="h-4 w-4 text-muted-foreground" />;

    if (mimeType.startsWith("image/")) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (mimeType.startsWith("video/")) {
      return <Play className="h-4 w-4 text-purple-500" />;
    }
    if (mimeType.startsWith("audio/")) {
      return <Play className="h-4 w-4 text-green-500" />;
    }
    if (mimeType.includes("pdf")) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (
      mimeType.includes("code") ||
      mimeType.includes("javascript") ||
      mimeType.includes("json")
    ) {
      return <Code className="h-4 w-4 text-yellow-500" />;
    }

    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Show overlay for hidden (full screen) or frozen (history only) */}
      {!canView && <MaskedOverlay variant="hidden" />}

      {/* Clean minimal header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 flex-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                connectionStatus === "connected"
                  ? `bg-green-500 ${isRefreshing ? "animate-pulse" : ""}`
                  : connectionStatus === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium text-foreground">
              {items.length > 0
                ? `${items.length} ${items.length === 1 ? "Item" : "Items"}`
                : "No Items"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Export button - hidden on mobile to prevent clutter */}
          {exportEnabled && canExport && items.length > 0 && (
            <div className="hidden sm:block">
              <ExportHistoryButton
                sessionCode={code}
                canExport={canExport}
                isHost={isHost}
              />
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={toggleAutoRefresh}
            className="h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
            title={
              autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"
            }
          >
            {autoRefreshEnabled ? (
              <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
            title={`Refresh data${
              autoRefreshEnabled ? " (Auto-refresh active)" : ""
            }`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all duration-200 ${
                isRefreshing
                  ? "animate-spin text-primary"
                  : autoRefreshEnabled
                    ? "text-primary"
                    : ""
              }`}
            />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={cycleTimeInterval}
            className="h-8 px-2 sm:px-2.5 text-xs font-medium hover:bg-muted/50 transition-all"
            title="Click to cycle interval (3s → 5s → 10s → 15s → 30s → 60s)"
          >
            <Timer className="h-3.5 w-3.5 mr-0.5 sm:mr-1" />
            <span className="hidden xs:inline">
              {autoRefreshInterval >= 1000
                ? `${autoRefreshInterval / 1000}s`
                : `${autoRefreshInterval}ms`}
            </span>
            <span className="xs:hidden">
              {autoRefreshInterval >= 1000
                ? `${autoRefreshInterval / 1000}`
                : autoRefreshInterval}
            </span>
          </Button>
        </div>
      </div>

      {/* Scrollable items area with frozen overlay */}
      <div className="flex-1 overflow-auto relative">
        {/* Frozen overlay only for this section */}
        {isFrozen && canView && <MaskedOverlay variant="frozen" />}

        {items.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center space-y-4">
              {/* Animated empty state illustration */}
              <div className="relative mx-auto w-32 h-32 mb-2">
                <div className="absolute inset-0 bg-primary/5 rounded-2xl animate-pulse"></div>
                <div className="absolute inset-2 bg-primary/10 rounded-xl"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-16 h-16 text-primary/30"
                    viewBox="0 0 100 100"
                    fill="none"
                  >
                    <rect
                      x="20"
                      y="30"
                      width="60"
                      height="8"
                      rx="4"
                      fill="currentColor"
                      opacity="0.6"
                    />
                    <rect
                      x="20"
                      y="46"
                      width="40"
                      height="8"
                      rx="4"
                      fill="currentColor"
                      opacity="0.4"
                    />
                    <rect
                      x="20"
                      y="62"
                      width="50"
                      height="8"
                      rx="4"
                      fill="currentColor"
                      opacity="0.5"
                    />
                    <circle
                      cx="75"
                      cy="25"
                      r="3"
                      fill="currentColor"
                      className="animate-ping"
                      style={{ animationDuration: "2s" }}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 p-1.5 sm:p-2 font-mono text-xs">
            {items.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const isLongContent = item.content && item.content.length > 200;
              const isOwnDevice = item.device_id === deviceId;
              const isCopied = copiedItems.has(item.id);

              // Log-style color coding
              const typeColors = {
                text: "text-blue-400 dark:text-blue-500",
                code: "text-purple-400 dark:text-purple-500",
                file: "text-green-400 dark:text-green-500",
              };
              const typeBg = {
                text: "bg-blue-500/5 hover:bg-blue-500/10",
                code: "bg-purple-500/5 hover:bg-purple-500/10",
                file: "bg-green-500/5 hover:bg-green-500/10",
              };

              return (
                <div
                  key={item.id}
                  className={`relative group rounded border border-border/40 ${typeBg[item.kind]} transition-colors`}
                >
                  {/* Shimmer effect during refresh */}
                  {isRefreshing && (
                    <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5 animate-shimmer pointer-events-none rounded" />
                  )}

                  {/* LOG ENTRY - Single compact line */}
                  <div className="flex items-start gap-2 px-2 py-1.5">
                    {/* Timestamp - Terminal style */}
                    <div className="flex-shrink-0 text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                      {item.display_created_at ? (
                        <span>
                          {new Date(item.display_created_at).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            }
                          )}
                        </span>
                      ) : (
                        <span>--:--:--</span>
                      )}
                    </div>

                    {/* Type indicator - Single char */}
                    <div
                      className={`flex-shrink-0 font-bold ${typeColors[item.kind]} mt-0.5`}
                    >
                      {item.kind === "text"
                        ? "T"
                        : item.kind === "code"
                          ? "C"
                          : "F"}
                    </div>

                    {/* Device - Compact */}
                    <div className="flex-shrink-0 text-[10px] text-muted-foreground/70 min-w-[60px] max-w-[80px] truncate mt-0.5">
                      {item.device_name || "unknown"}
                      {isOwnDevice && (
                        <span className="text-primary ml-1">*</span>
                      )}
                    </div>

                    {/* Content Preview - Main section */}
                    <div className="flex-1 min-w-0">
                      {item.kind === "file" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-foreground/90 truncate font-medium">
                            {item.file_name || "unknown.file"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {item.file_size
                              ? formatFileSize(item.file_size)
                              : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="text-foreground/90 truncate leading-tight">
                          {item.content && item.content.length > 100
                            ? item.content.substring(0, 100) + "..."
                            : item.content}
                        </div>
                      )}
                    </div>

                    {/* Action buttons - Hover visible */}
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.kind === "file" ? (
                        <>
                          <FilePreview
                            fileName={item.file_name || "file"}
                            fileUrl={item.file_download_url || ""}
                            mimeType={item.file_mime_type || ""}
                            size={item.file_size || 0}
                            onDownload={() => {
                              if (item.file_download_url) {
                                const link = document.createElement("a");
                                link.href = item.file_download_url;
                                link.download = item.file_name || "download";
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }
                            }}
                          />
                          {item.file_download_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = item.file_download_url!;
                                link.download = item.file_name || "download";
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="h-5 w-5 p-0"
                              title="Download"
                            >
                              <Download className="h-2.5 w-2.5" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {isLongContent && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpanded(item.id)}
                              className="h-5 w-5 p-0"
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-2.5 w-2.5" />
                              ) : (
                                <ChevronRight className="h-2.5 w-2.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(item.content || "", item.id)
                            }
                            className="h-5 w-5 p-0"
                            title="Copy"
                          >
                            {isCopied ? (
                              <Check className="h-2.5 w-2.5 text-green-500" />
                            ) : (
                              <Copy className="h-2.5 w-2.5" />
                            )}
                          </Button>
                        </>
                      )}
                      {allowItemDeletion && item.device_id === deviceId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteItem(item.id)}
                          className="h-5 w-5 p-0 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded content - Only shown when clicked */}
                  {isExpanded && item.kind !== "file" && (
                    <div className="px-2 pb-2 pl-[120px]">
                      <div className="border-t border-border/40 pt-1.5">
                        {item.kind === "code" ? (
                          <pre className="p-2 rounded bg-muted/30 text-[10px] font-mono text-foreground whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                            {item.content}
                          </pre>
                        ) : shouldRenderAsMarkdown(item.content || "") ? (
                          <div
                            className="prose prose-sm max-w-none p-2 rounded bg-muted/30 text-[10px] prose-headings:text-xs prose-p:text-[10px] max-h-60 overflow-y-auto"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(item.content || ""),
                            }}
                          />
                        ) : (
                          <div className="p-2 rounded bg-muted/30 text-[10px] text-foreground whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                            {item.content}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* End of scrollable items area */}

      {/* Session Expired Dialog */}
      <AlertDialog
        open={sessionExpiredOpen}
        onOpenChange={setSessionExpiredOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">
              Session Expired
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Your session has expired or was cleaned up. You'll be redirected
              to the home page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center">
            <AlertDialogAction
              onClick={() => {
                setSessionExpiredOpen(false);
                window.location.href = "/";
              }}
              className="w-full"
            >
              Go to Home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session Killed Dialog - Full Screen Overlay */}
      {sessionKilledOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 min-h-screen">
          <div className="relative max-w-md w-full">
            <div className="relative bg-card backdrop-blur-xl border-2 border-destructive/50 shadow-2xl rounded-2xl p-6 sm:p-8 text-center overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-destructive/10 via-destructive/5 to-destructive/10 blur-xl"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive via-destructive/80 to-destructive"></div>

              <div className="relative z-10">
                <div className="mx-auto mb-4 sm:mb-6 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-destructive/80 to-destructive flex items-center justify-center shadow-lg">
                  <Trash2
                    className="h-8 w-8 sm:h-10 sm:w-10 text-destructive-foreground"
                    strokeWidth={2.5}
                  />
                </div>

                <h3 className="text-xl sm:text-2xl font-bold mb-3 text-destructive">
                  Session Terminated
                </h3>

                <p className="text-sm text-muted-foreground mb-6">
                  The session has been terminated by the host.
                </p>

                <div className="my-6 sm:my-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-destructive to-destructive/80 shadow-xl shadow-destructive/30 animate-pulse">
                    <span className="text-4xl sm:text-5xl font-bold text-destructive-foreground">
                      {killCountdown}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Returning to home screen...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {isLeaving && <LeavingCountdown reason={leaveReason} />}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm({ open: false, itemId: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ open: false, itemId: null })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteItem}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
