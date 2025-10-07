"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import { generateSessionKey, encryptData } from "@/lib/encryption";
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

export default function ClipboardInput({ code }: { code: string }) {
  const [type, setType] = useState<ItemType>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!supabase || !sessionKey) return;
    setBusy(true);
    try {
      if (type === "file" && file) {
        // File upload
        const path = `${code}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("paperpaste")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        // Encrypt filename for privacy
        const encryptedFileName = await encryptData(file.name, sessionKey);
        const { error: insertError } = await doInsert({
          session_code: code,
          kind: "file",
          content_encrypted: encryptedFileName,
          file_url: path,
          device_id: deviceId,
        });
        if (insertError) throw insertError;
        setFile(null);
      } else if (text.trim()) {
        // Encrypt text/code content
        const encryptedContent = await encryptData(text.trim(), sessionKey);
        const { error } = await doInsert({
          session_code: code,
          kind: type,
          content_encrypted: encryptedContent,
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
        className={`flex flex-col gap-3 ${
          isFrozen ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <div className="flex gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant={type === "text" ? "default" : "secondary"}
            disabled={isFrozen}
            onClick={() => setType("text")}
            size="sm"
            className="flex-1 text-xs sm:text-sm py-2"
          >
            <Type className="h-4 w-4" />
            Text
          </Button>
          <Button
            type="button"
            variant={type === "code" ? "default" : "secondary"}
            onClick={() => setType("code")}
            size="sm"
            className="flex-1 text-xs sm:text-sm py-2"
          >
            <Code className="h-4 w-4" />
            Code
          </Button>
          <Button
            type="button"
            variant={type === "file" ? "default" : "secondary"}
            onClick={() => setType("file")}
            size="sm"
            className="flex-1 text-xs sm:text-sm py-2"
          >
            <FileText className="h-4 w-4" />
            File
          </Button>
        </div>

        {type === "file" ? (
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        ) : (
          <Textarea
            placeholder={
              type === "code"
                ? "Paste your code here...\n\nIndentation, spacing, and formatting will be preserved."
                : "Paste your text here...\n\nMarkdown formatting is supported."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`resize-none transition-all duration-200 ${
              type === "code"
                ? "font-mono text-xs sm:text-sm bg-muted/30 leading-relaxed"
                : "font-sans text-sm leading-normal"
            }`}
            style={{
              height: "clamp(200px, 50vh, 400px)",
              minHeight: "200px",
            }}
          />
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="submit"
            disabled={
              busy ||
              isFrozen ||
              !sessionKey ||
              (type === "file" ? !file : !text.trim())
            }
            className="w-full sm:w-auto px-6 py-2.5 font-medium"
            size="default"
          >
            {busy
              ? "Encrypting & Uploading..."
              : sessionKey
              ? "Share"
              : "Loading..."}
          </Button>
        </div>
      </form>
    </div>
  );
}
