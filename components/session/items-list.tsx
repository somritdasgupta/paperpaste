"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import FilePreview from "./file-preview";
import { marked } from "marked";
import DOMPurify from "dompurify";

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
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(3000); // 3 seconds default

  // Session dialog states
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  const [sessionKilledOpen, setSessionKilledOpen] = useState(false);
  const [killCountdown, setKillCountdown] = useState(5);

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

  // Check view permissions
  useEffect(() => {
    if (!supabase) return;

    const checkViewPermission = async () => {
      const { data } = await supabase
        .from("devices")
        .select("can_view")
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .single();

      if (data) {
        setCanView(data.can_view !== false);
      }
    };

    checkViewPermission();

    // Subscribe to view permission changes - listen to all devices in session
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
          console.log("Device permission change detected:", payload);
          // Check if this change affects our device
          if (payload.new && payload.new.device_id === deviceId) {
            console.log("Permission change for our device:", payload.new);
            setCanView(payload.new.can_view !== false);
            // Also trigger a data refresh to get updated device names
            fetchAndDecryptItems();
          }
        }
      )
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
          broadcast: { self: false },
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

            setItems((prev) => [decryptedItem, ...prev]);
          } else {
            // For updates and deletes, refetch all to maintain consistency
            if (active) fetchAndDecryptItems();
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

    // Add periodic refresh to ensure we don't miss anything
    const refreshInterval = setInterval(() => {
      if (active && autoRefreshEnabled) {
        fetchAndDecryptItems();
      }
    }, autoRefreshInterval);

    return () => {
      active = false;
      clearInterval(refreshInterval);
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(devicesChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(sessionKillChannel);
    };
  }, [supabase, code, sessionKey, autoRefreshEnabled, autoRefreshInterval]);

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

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        <div className="text-center">
          <div className="text-2xl mb-2">�</div>
          <div>You don't have permission to view shared items.</div>
        </div>
      </div>
    );
  }

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
      return <FileText className="h-5 w-5 text-muted-foreground" />;

    if (mimeType.startsWith("image/")) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    if (mimeType.startsWith("video/")) {
      return <Play className="h-5 w-5 text-purple-500" />;
    }
    if (mimeType.startsWith("audio/")) {
      return <Play className="h-5 w-5 text-green-500" />;
    }
    if (mimeType.includes("pdf")) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (
      mimeType.includes("code") ||
      mimeType.includes("javascript") ||
      mimeType.includes("json")
    ) {
      return <Code className="h-5 w-5 text-yellow-500" />;
    }

    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="w-full">
      {/* Clean minimal header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
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

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleAutoRefresh}
            className="h-8 w-8 p-0 hover:bg-muted/50"
            title={
              autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"
            }
          >
            {autoRefreshEnabled ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 p-0 hover:bg-muted/50"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4 w-4 transition-all duration-200 ${
                isRefreshing ? "animate-spin text-primary" : ""
              }`}
            />
          </Button>

          <select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            className="text-xs bg-background border border-border/50 rounded-md px-2 py-1 text-foreground hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
            title="Auto-refresh interval"
          >
            <option value={3000}>3s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <div className="text-center space-y-2">
            <FileText className="h-12 w-12 mx-auto opacity-50" />
            <div className="text-lg font-medium">No items shared yet</div>
            <div className="text-sm">
              Share text, code, or files to get started
            </div>
          </div>
        </div>
      ) : (
        <div className="relative space-y-2 sm:space-y-3 p-3 sm:p-4">
          {/* Beautiful shimmer overlay during refresh */}
          {isRefreshing && (
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/10 animate-shimmer pointer-events-none rounded-lg">
              <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-pulse opacity-60" />
            </div>
          )}
          {items.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const isLongContent = item.content && item.content.length > 200;
            const isOwnDevice = item.device_id === deviceId;
            const isCopied = copiedItems.has(item.id);

            return (
              <Card
                key={item.id}
                className={`hover:shadow-md transition-all duration-200 ${
                  isRefreshing
                    ? "bg-gradient-to-r from-background via-muted/20 to-background animate-pulse border-primary/20"
                    : ""
                }`}
              >
                <div className="p-3 sm:p-4">
                  {/* Compact Header */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {getDeviceIcon(item.device_name || "device")}
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.device_name || "Device"}
                        {isOwnDevice && (
                          <span className="text-muted-foreground ml-1">
                            (You)
                          </span>
                        )}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs h-5 px-1.5 capitalize ml-2"
                      >
                        {item.kind}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* File Content - Clean & Compact */}
                  {item.kind === "file" ? (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-shrink-0">
                        {getFileIcon(item.file_mime_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate text-sm">
                          {item.file_name || "Unknown File"}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {item.file_size && (
                            <span>{formatFileSize(item.file_size)}</span>
                          )}
                          {item.file_mime_type && item.file_size && (
                            <span>•</span>
                          )}
                          {item.file_mime_type && (
                            <span>{getFileType(item.file_mime_type)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
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
                            className="h-8 w-8 p-0 hover:bg-muted/50"
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="relative group">
                        {item.kind === "code" ? (
                          <pre className="p-3 rounded-lg bg-muted/30 text-xs sm:text-sm font-mono text-foreground overflow-x-auto scrollbar-thin">
                            {isLongContent && !isExpanded
                              ? truncateContent(item.content || "")
                              : item.content}
                          </pre>
                        ) : shouldRenderAsMarkdown(item.content || "") ? (
                          <div
                            className="prose prose-xs sm:prose-sm max-w-none p-3 rounded-lg bg-muted/30 text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-blockquote:text-muted-foreground"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(
                                isLongContent && !isExpanded
                                  ? truncateContent(item.content || "")
                                  : item.content || ""
                              ),
                            }}
                          />
                        ) : (
                          <div className="p-3 rounded-lg bg-muted/30 text-sm text-foreground whitespace-pre-wrap break-words">
                            {isLongContent && !isExpanded
                              ? truncateContent(item.content || "")
                              : item.content}
                          </div>
                        )}
                      </div>

                      {/* Compact Action bar */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/30">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.content?.length || 0} chars</span>
                          {isLongContent && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpanded(item.id)}
                              className="h-6 px-2 text-xs hover:bg-muted/50"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  <span className="ml-1">Less</span>
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="h-3 w-3" />
                                  <span className="ml-1">More</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(item.content || "", item.id)
                          }
                          className="h-8 w-8 p-0 hover:bg-muted/50"
                          title="Copy content"
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

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

      {/* Session Killed Dialog */}
      <AlertDialog open={sessionKilledOpen} onOpenChange={setSessionKilledOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-destructive">
              Session Terminated
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              The session has been terminated by the host.
              <br />
              <span className="font-medium mt-2 block">
                Redirecting in {killCountdown} seconds...
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center">
            <AlertDialogAction
              onClick={() => {
                setSessionKilledOpen(false);
                window.location.href = "/";
              }}
              className="w-full"
            >
              Go to Home Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
