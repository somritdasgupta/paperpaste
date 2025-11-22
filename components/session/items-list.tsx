"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { subscribeToGlobalRefresh, triggerGlobalRefresh } from "@/lib/globalRefresh";
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
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import MaskedOverlay from "@/components/ui/masked-overlay";
import LeavingCountdown from "./leaving-countdown";
import { useHistoryControls } from "./history-controls-context";
import FilePreview from "./file-preview";

type Item = {
  id: string;
  session_code: string;
  kind: "text" | "code" | "file";
  content_encrypted?: string | null;
  content?: string | null;
  file_url: string | null;
  file_data_encrypted?: string | null;
  file_name_encrypted?: string | null;
  file_mime_type_encrypted?: string | null;
  file_size_encrypted?: string | null;
  created_at_encrypted?: string | null;
  updated_at_encrypted?: string | null;
  display_id_encrypted?: string | null;
  file_name?: string;
  file_mime_type?: string;
  file_size?: number;
  file_download_url?: string;
  display_id?: string;
  display_created_at?: Date;
  display_updated_at?: Date;
  created_at: string;
  device_id?: string;
  device_name?: string;
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
  const [isHost, setIsHost] = useState(false);
  const [permissions, setPermissions] = useState({ export: true, delete: true });
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [devices, setDevices] = useState<Map<string, DeviceInfo>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5000);
  const itemsRef = useRef<string>("");
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveReason, setLeaveReason] = useState<"kicked" | "left" | "host-left">("kicked");

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  useEffect(() => {
    controls.setConnectionStatus(connectionStatus);
    controls.setItemsCount(items.length);
    controls.setExportEnabled(permissions.export);
    controls.setCanExport(permissions.export);
    controls.setIsHost(isHost);
    controls.setAutoRefreshEnabled(autoRefreshEnabled);
    controls.setAutoRefreshInterval(autoRefreshInterval);
    controls.setDeletionEnabled(permissions.delete);
    controls.setItems(items);
    controls.setSessionKey(sessionKey);
    controls.setDeviceId(deviceId);
  }, [connectionStatus, items, permissions, isHost, autoRefreshEnabled, autoRefreshInterval, sessionKey, deviceId, controls]);

  useEffect(() => {
    const handleManualRefresh = () => fetchAndDecryptItems(false);
    const handleToggleAutoRefresh = () => setAutoRefreshEnabled((prev) => !prev);
    const handleCycleTimeInterval = () => {
      setAutoRefreshInterval((prev) => {
        const intervals = [3000, 5000, 10000, 15000, 30000, 60000];
        const currentIndex = intervals.indexOf(prev);
        return intervals[(currentIndex + 1) % intervals.length];
      });
    };

    window.addEventListener("manual-refresh", handleManualRefresh);
    window.addEventListener("toggle-auto-refresh", handleToggleAutoRefresh);
    window.addEventListener("cycle-time-interval", handleCycleTimeInterval);

    return () => {
      window.removeEventListener("manual-refresh", handleManualRefresh);
      window.removeEventListener("toggle-auto-refresh", handleToggleAutoRefresh);
      window.removeEventListener("cycle-time-interval", handleCycleTimeInterval);
    };
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled || !supabase || !sessionKey) return;
    const refreshTimer = setInterval(() => fetchAndDecryptItems(false), autoRefreshInterval);
    return () => clearInterval(refreshTimer);
  }, [autoRefreshEnabled, autoRefreshInterval, supabase, sessionKey]);

  const fetchAndDecryptItems = async (showLoading = false) => {
    if (!supabase || !sessionKey) return;

    try {
      setError(null);
      setConnectionStatus("connecting");

      const { data: devicesData } = await supabase
        .from("devices")
        .select("device_id, device_name_encrypted")
        .eq("session_code", code);

      if (!devicesData?.some((d) => d.device_id === deviceId)) {
        localStorage.removeItem(`pp-host-${code}`);
        localStorage.removeItem(`pp-joined-${code}`);
        setLeaveReason("kicked");
        setIsLeaving(true);
        return;
      }

      const deviceMap = new Map<string, DeviceInfo>();
      if (devicesData) {
        for (const device of devicesData) {
          let deviceName = "Anonymous Device";
          if (device.device_name_encrypted) {
            try {
              deviceName = await decryptDeviceName(device.device_name_encrypted, sessionKey);
            } catch (e) {}
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
        setError(error.message);
        setConnectionStatus("disconnected");
        return;
      }

      if (!data) {
        setConnectionStatus("connected");
        return;
      }

      const decryptedItems = await Promise.all(
        data.map(async (item: any) => {
          let content = null;
          if (item.content_encrypted) {
            try {
              content = await decryptData(item.content_encrypted, sessionKey);
            } catch (e) {
              content = "[Encrypted Content - Unable to Decrypt]";
            }
          }

          let fileName = null, fileMimeType = null, fileSize = null, fileDownloadUrl = null;
          if (item.kind === "file" && item.file_data_encrypted) {
            try {
              if (item.file_name_encrypted) fileName = await decryptData(item.file_name_encrypted, sessionKey);
              if (item.file_mime_type_encrypted) fileMimeType = await decryptData(item.file_mime_type_encrypted, sessionKey);
              if (item.file_size_encrypted) fileSize = parseInt(await decryptData(item.file_size_encrypted, sessionKey), 10);
              if (fileMimeType) fileDownloadUrl = await createEncryptedFileDownloadUrl(item.file_data_encrypted, sessionKey, fileMimeType, fileName || undefined);
            } catch (e) {
              fileName = "[Encrypted File]";
            }
          }

          let displayId = null, displayCreatedAt = null, displayUpdatedAt = null;
          try {
            if (item.display_id_encrypted) displayId = await decryptDisplayId(item.display_id_encrypted, sessionKey);
            if (item.created_at_encrypted) displayCreatedAt = await decryptTimestamp(item.created_at_encrypted, sessionKey);
            if (item.updated_at_encrypted) displayUpdatedAt = await decryptTimestamp(item.updated_at_encrypted, sessionKey);
          } catch (e) {}

          const deviceInfo = deviceMap.get(item.device_id);
          return {
            ...item,
            content,
            device_name: deviceInfo?.device_name || "Anonymous Device",
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

      const newItemsHash = JSON.stringify(decryptedItems.map(i => i.id + i.content?.substring(0, 50)));
      if (itemsRef.current !== newItemsHash) {
        itemsRef.current = newItemsHash;
        setItems(decryptedItems);
      }
      setConnectionStatus("connected");
    } catch (e: any) {
      setError(e?.message || "Failed to fetch items");
      setConnectionStatus("disconnected");
    }
  };

  useEffect(() => {
    if (!supabase || !sessionKey) return;
    const fetchDevices = async () => {
      const { data } = await supabase.from("devices").select("device_id, device_name_encrypted").eq("session_code", code);
      if (data) {
        const deviceMap = new Map<string, DeviceInfo>();
        await Promise.all(
          data.map(async (device) => {
            let deviceName = "Anonymous Device";
            if (device.device_name_encrypted) {
              try {
                deviceName = await decryptDeviceName(device.device_name_encrypted, sessionKey);
              } catch (e) {}
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

  useEffect(() => {
    if (!supabase || !deviceId) return;

    const checkViewPermission = async () => {
      const { data } = await supabase
        .from("devices")
        .select("can_view, is_frozen, can_export, can_delete_items, is_host")
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .single();

      if (data) {
        setCanView(data.can_view !== false);
        setIsFrozen(data.is_frozen === true);
        setIsHost(data.is_host === true);
      }

      const [devicePerms, sessionPerms] = await Promise.all([
        supabase.from("devices").select("can_export, can_delete_items").eq("session_code", code).eq("device_id", deviceId).single(),
        supabase.from("sessions").select("export_enabled, allow_item_deletion").eq("code", code).single()
      ]);

      setPermissions({
        export: sessionPerms.data?.export_enabled !== false,
        delete: (devicePerms.data?.can_delete_items !== false) && (sessionPerms.data?.allow_item_deletion !== false)
      });
    };

    checkViewPermission();

    const viewChannel = supabase
      .channel(`view-permissions-${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "devices", filter: `session_code=eq.${code}` }, (payload) => {
        if (payload.new && payload.new.device_id === deviceId) {
          setCanView(payload.new.can_view !== false);
          setIsFrozen(payload.new.is_frozen === true);
          setIsHost(payload.new.is_host === true);
          setPermissions(prev => ({ ...prev, export: payload.new.can_export !== false, delete: payload.new.can_delete_items !== false }));
          fetchAndDecryptItems();
          try { triggerGlobalRefresh(); } catch {}
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `code=eq.${code}` }, async (payload) => {
        if (payload.new) {
          const devicePerms = await supabase.from("devices").select("can_export, can_delete_items").eq("session_code", code).eq("device_id", deviceId).single();
          setPermissions({
            export: (devicePerms.data?.can_export !== false) && (payload.new.export_enabled !== false),
            delete: (devicePerms.data?.can_delete_items !== false) && (payload.new.allow_item_deletion !== false)
          });
          try { triggerGlobalRefresh(); } catch {}
        }
      })
      .on("broadcast", { event: "export_toggle" }, (payload) => setPermissions(prev => ({ ...prev, export: payload.payload.export_enabled !== false })))
      .on("broadcast", { event: "deletion_toggle" }, (payload) => setPermissions(prev => ({ ...prev, delete: payload.payload.allow_item_deletion !== false })))
      .on("broadcast", { event: "permission_changed" }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          setCanView(payload.payload.can_view !== false);
          setIsFrozen(payload.payload.is_frozen === true);
          setPermissions(prev => ({ ...prev, export: payload.payload.can_export !== false, delete: payload.payload.can_delete_items !== false }));
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
      .on("broadcast", { event: "global_refresh" }, () => { try { triggerGlobalRefresh(); } catch {} })
      .subscribe();

    return () => {
      supabase.removeChannel(viewChannel);
    };
  }, [supabase, code, deviceId]);

  useEffect(() => {
    if (!supabase || !sessionKey) return;

    const unsubscribeRefresh = subscribeToGlobalRefresh(() => {
      fetchAndDecryptItems();
      if (supabase && deviceId) {
        Promise.all([
          supabase.from("devices").select("can_export, can_delete_items").eq("session_code", code).eq("device_id", deviceId).single(),
          supabase.from("sessions").select("export_enabled, allow_item_deletion").eq("code", code).single()
        ]).then(([devicePerms, sessionPerms]) => {
          setPermissions({
            export: (devicePerms.data?.can_export !== false) && (sessionPerms.data?.export_enabled !== false),
            delete: (devicePerms.data?.can_delete_items !== false) && (sessionPerms.data?.allow_item_deletion !== false)
          });
        });
      }
    });

    const devicesChannel = supabase
      .channel(`devices-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `session_code=eq.${code}` }, async (payload) => {
        const newDevice = payload.new as any;
        if (newDevice && newDevice.device_id) {
          let deviceName = "Anonymous Device";
          if (newDevice.device_name_encrypted) {
            try {
              deviceName = await decryptDeviceName(newDevice.device_name_encrypted, sessionKey);
            } catch (e) {}
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
      })
      .subscribe();

    const itemsChannel = supabase
      .channel(`items-realtime-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `session_code=eq.${code}` }, () => {
        try { triggerGlobalRefresh(); } catch {}
      })
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
      setTimeout(() => setCopiedItems((prev) => { const next = new Set(prev); next.delete(id); return next; }), 2000);
    } catch (err) {}
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    <div className="w-full h-full overflow-hidden">
      {(!canView || isFrozen) && <MaskedOverlay variant={!canView ? "hidden" : "frozen"} />}
      {isLeaving && <LeavingCountdown reason={leaveReason} />}
      {items.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900/50 dark:to-slate-950/50" style={{overflow: 'hidden'}}>
          <div className="text-center px-4 -mt-12 animate-in fade-in duration-1000">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-gray-200/30 dark:text-zinc-800/30 select-none">PaperPaste</h1>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-400/50 dark:text-zinc-700/50 mt-2 text-right">by @somritdasgupta</p>
          </div>
        </div>
      ) : (
        <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900/50 dark:to-slate-950/50">
          <div className="p-2 space-y-1 min-h-full">
            {items.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const isCopied = copiedItems.has(item.id);
              const timestamp = item.display_created_at
                ? item.display_created_at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : new Date(item.created_at).toLocaleTimeString();

              return (
                <div
                  key={item.id}
                  className={`group relative border backdrop-blur-md overflow-hidden transition-all duration-300 ease-out ${
                    isExpanded
                      ? "border-white/20 dark:border-white/10 bg-white/10 dark:bg-white/5 pb-3 shadow-lg shadow-black/5 dark:shadow-black/20"
                      : "border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/3 hover:bg-white/15 dark:hover:bg-white/8 shadow-sm shadow-black/5"
                  }`}
                >
                  <div className="flex items-center gap-2 p-2 px-3 h-10">
                    <button onClick={() => toggleExpanded(item.id)} className="text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 shrink-0 transition-all duration-200 ease-out hover:scale-110">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span className="text-gray-500 dark:text-zinc-600 text-[9px] shrink-0 font-bold">{timestamp}</span>
                    <span className="text-blue-600 dark:text-blue-500 text-[9px] shrink-0 font-bold">{item.device_name || "unknown"}</span>
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
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      {item.kind === "file" && item.file_download_url && (
                        <FilePreview
                          fileName={item.file_name || "file"}
                          fileUrl={item.file_download_url}
                          mimeType={item.file_mime_type || "application/octet-stream"}
                          size={item.file_size || 0}
                          onDownload={() => {
                            const a = document.createElement('a');
                            a.href = item.file_download_url!;
                            a.download = item.file_name || 'file';
                            a.click();
                          }}
                        />
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-200/80 dark:hover:bg-zinc-800 transition-all duration-200 hover:scale-110" onClick={(e) => { e.stopPropagation(); copyToClipboard(item.content || "", item.id); }} title="Copy content">
                        {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      {permissions.export && (
                        item.kind === "file" && item.file_download_url ? (
                          <a href={item.file_download_url} download={item.file_name} className="inline-flex items-center justify-center h-6 w-6 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-all duration-200 hover:scale-110" title="Download file" onClick={(e) => e.stopPropagation()}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all duration-200 hover:scale-110" onClick={(e) => { e.stopPropagation(); const blob = new Blob([item.content || ''], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${item.kind}-${item.id.substring(0, 8)}.txt`; a.click(); URL.revokeObjectURL(url); }} title="Download as text">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-green-400 hover:bg-zinc-800 transition-all duration-200 hover:scale-110" onClick={(e) => { e.stopPropagation(); openBottomSheet("verification", { isItemVerification: true, itemType: item.kind, sessionKey }); }} title="Verify Integrity">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </Button>
                      {permissions.delete && item.device_id === deviceId && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all duration-200 hover:scale-110" onClick={(e) => { e.stopPropagation(); openBottomSheet("delete-item", { itemId: item.id }); }} title="Delete item">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-3 mt-1 animate-in slide-in-from-top-2 fade-in duration-300 space-y-1">
                      {/* Metadata Section */}
                      <div className="bg-zinc-900/20 border border-zinc-800/50 p-1.5">
                        <div className="text-[10px] font-semibold text-zinc-400 mb-1">Metadata</div>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          <div>
                            <span className="text-zinc-500">Type:</span>
                            <span className="ml-2 text-zinc-300 font-medium">{item.kind}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Device:</span>
                            <span className="ml-2 text-zinc-300 font-medium">{item.device_name || "Unknown"}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Created:</span>
                            <span className="ml-2 text-zinc-300 font-medium">
                              {item.display_created_at ? item.display_created_at.toLocaleString() : new Date(item.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Item ID:</span>
                            <span className="ml-2 text-zinc-300 font-mono text-[10px]">{item.id.substring(0, 8)}...</span>
                          </div>
                          {item.kind === "file" && (
                            <>
                              <div>
                                <span className="text-zinc-500">File Size:</span>
                                <span className="ml-2 text-zinc-300 font-medium">
                                  {item.file_size && item.file_size > 1024 * 1024 
                                    ? `${(item.file_size / (1024 * 1024)).toFixed(2)} MB` 
                                    : `${Math.round((item.file_size || 0) / 1024)} KB`}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500">MIME Type:</span>
                                <span className="ml-2 text-zinc-300 font-mono text-[10px]">{item.file_mime_type}</span>
                              </div>
                            </>
                          )}
                          {(item.kind === "text" || item.kind === "code") && item.content && (
                            <div>
                              <span className="text-zinc-500">Length:</span>
                              <span className="ml-2 text-zinc-300 font-medium">{item.content.length} characters</span>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500">Encryption:</span>
                            <span className="ml-2 text-green-400 font-medium">AES-256-GCM</span>
                          </div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="bg-zinc-900/30 border border-zinc-800">
                        <div className="px-1.5 py-1 border-b border-zinc-800/50">
                          <span className="text-[10px] font-semibold text-zinc-400">Content</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-zinc-700">
                          {item.kind === "text" && <div className="text-xs leading-snug text-zinc-200 whitespace-pre-wrap break-words">{item.content}</div>}
                          {item.kind === "code" && <pre className="text-[10px] text-zinc-200 whitespace-pre-wrap break-words font-mono leading-snug"><code>{item.content}</code></pre>}
                          {item.kind === "file" && (
                            <div className="flex items-start gap-2 p-1.5 bg-zinc-900/50 border border-zinc-800">
                              <div className="p-1.5 bg-zinc-950 text-zinc-400">{getContentIcon("file", item.file_mime_type)}</div>
                              <div className="flex-1">
                                <p className="font-medium text-zinc-200 mb-1">{item.file_name}</p>
                                <p className="text-xs text-zinc-500">
                                  {item.file_size && item.file_size > 1024 * 1024 ? `${(item.file_size / (1024 * 1024)).toFixed(2)} MB` : `${Math.round((item.file_size || 0) / 1024)} KB`}
                                  • {item.file_mime_type}
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
            })}
          </div>
        </div>
      )}
    </div>
  );
}
