"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import { generateSessionKey, encryptData } from "@/lib/encryption";

type ItemType = "text" | "code" | "file";

export default function ClipboardInput({ code }: { code: string }) {
  const [type, setType] = useState<ItemType>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [canView, setCanView] = useState(true);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const supabase = getSupabaseBrowserWithCode(code);
  const deviceId = getOrCreateDeviceId();

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

    // first try
    const { error } = await supabase.from("items").insert(payload);
    if (!error) return { error: null };

    const msg = String(error?.message || "");
    const code = (error as any)?.code;
    const isMissingTable =
      code === "42P01" ||
      (msg.includes("relation") && msg.includes("does not exist")) ||
      msg.includes("Could not find the table 'public.items'");

    if (isMissingTable) {
      console.log("[v0] items missing - initializing schema then retrying");
      const res = await fetch("/api/schema/init", { method: "POST" });
      if (res.ok) {
        const retry = await supabase.from("items").insert(payload);
        return { error: retry.error || null };
      }
    }
    return { error };
  };

  const submit = async () => {
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
        const { error: insertError } = await supabase.from("items").insert({
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
        const { error } = await supabase.from("items").insert({
          session_code: code,
          kind: type,
          content_encrypted: encryptedContent,
          device_id: deviceId,
        });
        if (error) throw error;
        setText("");
      }
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="text-2xl mb-2">🚫</div>
        <div>You don't have permission to view this session.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isFrozen && (
        <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-orange-700 dark:text-orange-300">
            <span className="text-lg">🧊</span>
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
        <div className="flex gap-2">
          <Button
            type="button"
            variant={type === "text" ? "default" : "secondary"}
            disabled={isFrozen}
            onClick={() => setType("text")}
          >
            Text
          </Button>
          <Button
            type="button"
            variant={type === "code" ? "default" : "secondary"}
            onClick={() => setType("code")}
          >
            Code
          </Button>
          <Button
            type="button"
            variant={type === "file" ? "default" : "secondary"}
            onClick={() => setType("file")}
          >
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
            className={`h-[60vh] min-h-[300px] resize-none ${
              type === "code" ? "font-mono text-sm bg-muted/30" : "font-sans"
            }`}
            style={{
              height: "60vh",
              minHeight: "300px",
            }}
          />
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={
              busy ||
              isFrozen ||
              !sessionKey ||
              (type === "file" ? !file : !text.trim())
            }
          >
            {busy
              ? "Encrypting & Uploading..."
              : sessionKey
              ? "Share (Encrypted)"
              : "Loading..."}
          </Button>
        </div>
        {sessionKey && (
          <p className="text-xs text-muted-foreground text-center">
            🔒 All content is encrypted end-to-end for privacy
          </p>
        )}
      </form>
    </div>
  );
}
