"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import {
  generateSessionKey,
  decryptData,
  decryptDeviceName,
} from "@/lib/encryption";

type Item = {
  id: string;
  session_code: string;
  kind: "text" | "code" | "file";
  content_encrypted?: string | null;
  content?: string | null; // decrypted content for display
  file_url: string | null;
  created_at: string;
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
  const deviceId = getOrCreateDeviceId();

  // Initialize session encryption key
  useEffect(() => {
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

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

    // Subscribe to view permission changes
    const viewChannel = supabase
      .channel(`view-permissions-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          if (payload.new) {
            setCanView(payload.new.can_view !== false);
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

    const fetchAndDecryptItems = async () => {
      try {
        const { data, error } = await supabase
          .from("items")
          .select(
            `
            *,
            devices!inner(
              device_id,
              device_name_encrypted
            )
          `
          )
          .eq("session_code", code)
          .order("created_at", { ascending: false })
          .limit(200);

        if (!active || error) return;
        if (!data) return;

        // Decrypt content and device names for display
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

            // Get device name from devices map or decrypt from item
            let deviceName = "Anonymous Device";
            const deviceInfo = devices.get(item.devices?.device_id);
            if (deviceInfo?.device_name) {
              deviceName = deviceInfo.device_name;
            } else if (item.devices?.device_name_encrypted) {
              try {
                deviceName = await decryptDeviceName(
                  item.devices.device_name_encrypted,
                  sessionKey
                );
              } catch (e) {
                console.warn("Failed to decrypt device name:", e);
              }
            }

            return {
              ...item,
              content,
              device_id: item.devices?.device_id,
              device_name: deviceName,
            };
          })
        );

        setItems(decryptedItems);
      } catch (e) {
        console.error("Error fetching items:", e);
      }
    };

    fetchAndDecryptItems();

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
            const decryptedItem = { ...newItem, content };

            setItems((prev) => [decryptedItem, ...prev]);
          } else {
            // For updates and deletes, refetch all to maintain consistency
            fetchAndDecryptItems();
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
          alert("Session has expired or was cleaned up.");
          window.location.href = "/";
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [supabase, code, sessionKey]);

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
          <div className="text-2xl mb-2">🔐</div>
          <div>Loading encrypted session...</div>
        </div>
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

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
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
    if (deviceName.includes("Phone") || deviceName.includes("Mobile"))
      return "📱";
    if (deviceName.includes("Tablet") || deviceName.includes("iPad"))
      return "💻";
    if (deviceName.includes("Desktop") || deviceName.includes("PC"))
      return "🖥️";
    return "📟"; // Generic device icon
  };

  return (
    <div className="w-full">
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <div className="text-center">
            <div className="text-2xl mb-2">📋</div>
            <div>No items yet. Share something to get started!</div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {items.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const isLongContent = item.content && item.content.length > 200;
            const isOwnDevice = item.device_id === deviceId;

            return (
              <Card key={item.id} className="relative">
                <div className="p-4">
                  {/* Header with device info and timestamp */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isOwnDevice ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {getDeviceIcon(item.device_name || "Unknown")}
                        {item.device_name || "Anonymous Device"}
                        {isOwnDevice && " (You)"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.kind.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Content */}
                  {item.kind === "file" && item.file_url ? (
                    <div className="flex items-center justify-between">
                      <a
                        href={publicUrlFor(item.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline break-all flex items-center gap-2"
                      >
                        📎 {item.content || "Download file"}
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          copyToClipboard(publicUrlFor(item.file_url || ""))
                        }
                        className="h-8 px-3"
                      >
                        📋 Copy Link
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <pre
                        className={`whitespace-pre-wrap text-sm p-3 rounded-md ${
                          item.kind === "code"
                            ? "bg-muted font-mono border"
                            : "bg-background"
                        }`}
                      >
                        {isLongContent && !isExpanded
                          ? truncateContent(item.content || "")
                          : item.content}
                      </pre>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(item.content || "")}
                          className="h-8 px-3"
                        >
                          📋 Copy
                        </Button>

                        {isLongContent && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleExpanded(item.id)}
                            className="h-8 px-3"
                          >
                            {isExpanded ? "▼ Collapse" : "▶ Expand"}
                          </Button>
                        )}

                        <div className="text-xs text-muted-foreground ml-auto">
                          {item.content?.length || 0} chars
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
