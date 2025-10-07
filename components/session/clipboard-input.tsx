"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import {
  generateSessionKey,
  encryptData,
  encryptFile,
  encryptTimestamp,
  encryptDisplayId,
  generateDisplayId,
} from "@/lib/encryption";
import {
  Type,
  Code,
  FileText,
  Upload,
  Shield,
  Loader2,
  Send,
} from "lucide-react";

type ItemType = "text" | "code" | "file";

// File size limits and supported types
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max for stability
const SUPPORTED_FILE_TYPES = {
  // Microsoft Office
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "application/msword": ".doc",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.ms-powerpoint": ".ppt",

  // Images
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",

  // Audio
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/webm": ".webm",

  // Video
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/avi": ".avi",
  "video/mov": ".mov",

  // Documents
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/rtf": ".rtf",

  // Code files
  "text/javascript": ".js",
  "application/json": ".json",
  "text/html": ".html",
  "text/css": ".css",
  "application/xml": ".xml",
  "text/x-python": ".py",
  "text/x-java-source": ".java",
  "text/x-c": ".c",
  "text/x-c++": ".cpp",
  "text/x-csharp": ".cs",
  "text/x-php": ".php",
  "text/x-ruby": ".rb",
  "text/x-go": ".go",
  "text/x-rust": ".rs",
  "text/x-swift": ".swift",
  "text/x-kotlin": ".kt",
  "text/x-scala": ".scala",
  "text/x-sql": ".sql",
  "text/markdown": ".md",
  "text/yaml": ".yml",
  "application/x-yaml": ".yaml",
  "application/toml": ".toml",
};

export default function ClipboardInput({ code }: { code: string }) {
  const [type, setType] = useState<ItemType>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [canView, setCanView] = useState(true);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const supabase = getSupabaseBrowserWithCode(code);

  // Initialize device ID on client side
  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // Initialize session encryption key
  useEffect(() => {
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  // Check device permissions
  useEffect(() => {
    if (!supabase) return;

    const checkPermissions = async () => {
      const { data } = await supabase
        .from("devices")
        .select("is_frozen, can_view")
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .single();

      if (data) {
        setIsFrozen(data.is_frozen || false);
        setCanView(data.can_view !== false);
      }
    };

    checkPermissions();

    // Subscribe to permission changes
    const channel = supabase
      .channel(`device-permissions-${deviceId}`)
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
            setIsFrozen(payload.new.is_frozen || false);
            setCanView(payload.new.can_view !== false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, code, deviceId]);

  const doInsert = async (payload: any) => {
    if (!supabase) return { error: new Error("Supabase not configured") };

    const { error } = await supabase.from("items").insert(payload);
    return { error };
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size (${(file.size / 1024 / 1024).toFixed(
        2
      )}MB) exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    // Check if file type is supported
    if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
      // Check by file extension as fallback
      const extension = "." + file.name.split(".").pop()?.toLowerCase();
      const isSupportedByExtension = Object.values(
        SUPPORTED_FILE_TYPES
      ).includes(extension as any);

      if (!isSupportedByExtension) {
        return `File type "${
          file.type || "unknown"
        }" is not supported. Supported formats: Microsoft Office, Images, Audio, Video, Documents, and Code files.`;
      }
    }

    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFileError(null);

    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        setFileError(error);
        setFile(null);
        return;
      }
    }

    setFile(selectedFile);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!supabase || !sessionKey) return;
    setBusy(true);
    try {
      if (type === "file" && file) {
        // Encrypt file completely client-side for zero-knowledge storage
        const { encryptedData, originalName, mimeType, size } =
          await encryptFile(file, sessionKey);

        // Encrypt metadata
        const encryptedFileName = await encryptData(originalName, sessionKey);
        const encryptedMimeType = await encryptData(mimeType, sessionKey);
        const encryptedSize = await encryptData(size.toString(), sessionKey);

        // Enhanced encryption: encrypt timestamps and display ID
        const now = new Date();
        const createdAtEncrypted = await encryptTimestamp(now, sessionKey);
        const updatedAtEncrypted = await encryptTimestamp(now, sessionKey);
        const displayId = generateDisplayId();
        const displayIdEncrypted = await encryptDisplayId(
          displayId,
          sessionKey
        );

        // Store encrypted file data directly in database (no file storage needed)
        const { error: insertError } = await doInsert({
          session_code: code,
          kind: "file",
          file_data_encrypted: encryptedData,
          file_name_encrypted: encryptedFileName,
          file_mime_type_encrypted: encryptedMimeType,
          file_size_encrypted: encryptedSize,
          created_at_encrypted: createdAtEncrypted,
          updated_at_encrypted: updatedAtEncrypted,
          display_id_encrypted: displayIdEncrypted,
          device_id: deviceId,
        });
        if (insertError) throw insertError;
        setFile(null);
      } else if (text.trim()) {
        // Encrypt text/code content
        const encryptedContent = await encryptData(text.trim(), sessionKey);

        // Enhanced encryption: encrypt timestamps and display ID
        const now = new Date();
        const createdAtEncrypted = await encryptTimestamp(now, sessionKey);
        const updatedAtEncrypted = await encryptTimestamp(now, sessionKey);
        const displayId = generateDisplayId();
        const displayIdEncrypted = await encryptDisplayId(
          displayId,
          sessionKey
        );

        const { error } = await doInsert({
          session_code: code,
          kind: type,
          content_encrypted: encryptedContent,
          created_at_encrypted: createdAtEncrypted,
          updated_at_encrypted: updatedAtEncrypted,
          display_id_encrypted: displayIdEncrypted,
          device_id: deviceId,
        });
        if (error) throw error;
        setText("");
      }
    } catch (e: any) {
      console.error("Submit error:", e);
      alert(
        e?.message ||
          "Upload failed. Please check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full mb-2">
          <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div>You don't have permission to view this session.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isFrozen && (
        <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-orange-700 dark:text-orange-300">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">
              Your clipboard is frozen by the host
            </span>
          </div>
        </div>
      )}

      <form
        onSubmit={submit}
        className={`flex flex-col gap-2 sm:gap-3 ${
          isFrozen ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <div className="flex gap-1 sm:gap-2">
          <Button
            type="button"
            variant={type === "text" ? "default" : "secondary"}
            disabled={isFrozen}
            onClick={() => setType("text")}
            size="sm"
            className="flex-1 text-xs sm:text-sm py-1.5 sm:py-2 px-2 sm:px-3"
          >
            <Type className="h-4 w-4" />
            Text
          </Button>
          <Button
            type="button"
            variant={type === "code" ? "default" : "secondary"}
            onClick={() => setType("code")}
            size="sm"
            className="flex-1 text-xs sm:text-sm py-1.5 sm:py-2 px-2 sm:px-3"
          >
            <Code className="h-4 w-4" />
            Code
          </Button>
          <Button
            type="button"
            variant={type === "file" ? "default" : "secondary"}
            onClick={() => setType("file")}
            size="sm"
            className="flex-1 text-xs sm:text-sm py-1.5 sm:py-2 px-2 sm:px-3"
          >
            <FileText className="h-4 w-4" />
            File
          </Button>
        </div>

        {type === "file" ? (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={handleFileChange}
              accept={Object.keys(SUPPORTED_FILE_TYPES).join(",")}
              className={fileError ? "border-destructive" : ""}
            />
            {fileError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                {fileError}
              </div>
            )}
            {file && !fileError && (
              <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs ml-2 flex-shrink-0">
                    {(file.size / 1024 / 1024).toFixed(2)}MB
                  </span>
                </div>
                <div className="text-xs mt-1 text-muted-foreground">
                  {file.type || "Unknown type"} • Max:{" "}
                  {MAX_FILE_SIZE / 1024 / 1024}MB
                </div>
              </div>
            )}
            {/* Send button for files */}
            <Button
              type="submit"
              disabled={busy || isFrozen || !sessionKey || !file || !!fileError}
              className="w-full font-medium"
              size="default"
            >
              {busy
                ? "Encrypting & Uploading..."
                : sessionKey
                ? "Share File"
                : "Loading..."}
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Textarea
              placeholder={
                type === "code"
                  ? "Paste your code here...\n\nIndentation, spacing, and formatting will be preserved.\n\nPress Ctrl+Enter (Cmd+Enter on Mac) to share."
                  : "Paste your text here...\n\nMarkdown formatting is supported.\n\nPress Ctrl+Enter (Cmd+Enter on Mac) to share."
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              className={`resize-none transition-all duration-200 pr-12 ${
                type === "code"
                  ? "font-mono text-xs sm:text-sm bg-muted/30 leading-relaxed"
                  : "font-sans text-sm leading-normal"
              }`}
              style={{
                height: "clamp(200px, 50vh, 400px)",
                minHeight: "200px",
              }}
            />
            {/* Inline Send Button */}
            <Button
              type="submit"
              disabled={busy || isFrozen || !sessionKey || !text.trim()}
              size="sm"
              className="absolute bottom-3 right-3 h-8 px-3 font-medium shadow-sm"
              title="Send (Ctrl+Enter)"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {/* Keyboard shortcut info */}
        {type !== "file" && (
          <div className="text-xs text-muted-foreground text-center">
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">
              Ctrl+Enter
            </kbd>{" "}
            to share
          </div>
        )}
      </form>
    </div>
  );
}
