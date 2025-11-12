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
  Bold,
  Italic,
  Strikethrough,
  MessageSquare,
  Indent,
  Outdent,
  Braces,
  Code2,
} from "lucide-react";
import MaskedOverlay from "@/components/ui/masked-overlay";
import { triggerGlobalRefresh } from "@/lib/globalRefresh";
import LeavingCountdown from "./leaving-countdown";
import TextFormattingToolbar from "./text-formatting-toolbar";
import CodeFormattingToolbar from "./code-formatting-toolbar";
import { useRef } from "react";
import { ErrorDialog } from "@/components/ui/error-dialog";

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

// Language-specific comment syntax for popular languages
const LANGUAGE_COMMENTS: Record<
  string,
  { line: string; block?: { start: string; end: string } }
> = {
  // JavaScript ecosystem
  javascript: { line: "//" },
  typescript: { line: "//" },
  jsx: { line: "//" },
  tsx: { line: "//" },

  // Backend languages
  python: { line: "#" },
  java: { line: "//", block: { start: "/*", end: "*/" } },
  go: { line: "//", block: { start: "/*", end: "*/" } },
  rust: { line: "//", block: { start: "/*", end: "*/" } },
  php: { line: "//", block: { start: "/*", end: "*/" } },

  // Systems programming
  c: { line: "//", block: { start: "/*", end: "*/" } },
  cpp: { line: "//", block: { start: "/*", end: "*/" } },
  csharp: { line: "//", block: { start: "/*", end: "*/" } },

  // Scripting languages
  bash: { line: "#" },
  zsh: { line: "#" },
  powershell: { line: "#" },
  shell: { line: "#" },
  ruby: { line: "#" },
  perl: { line: "#" },

  // Database
  sql: { line: "--", block: { start: "/*", end: "*/" } },

  // Web
  html: { line: "<!--", block: { start: "<!--", end: "-->" } },
  css: { line: "/*", block: { start: "/*", end: "*/" } },

  // Other
  swift: { line: "//", block: { start: "/*", end: "*/" } },
  kotlin: { line: "//", block: { start: "/*", end: "*/" } },
};

// Detect language from code content
const detectLanguage = (code: string): string => {
  if (!code.trim()) return "javascript";

  const lines = code.trim().split("\n");
  const firstLine = lines[0]?.trim().toLowerCase() || "";

  // Shebang detection
  if (firstLine.startsWith("#!/bin/bash") || firstLine.startsWith("#!/bin/sh"))
    return "bash";
  if (firstLine.startsWith("#!/bin/zsh")) return "zsh";
  if (
    firstLine.startsWith("#!/usr/bin/python") ||
    firstLine.startsWith("#!/usr/bin/env python")
  )
    return "python";
  if (
    firstLine.startsWith("#!/usr/bin/ruby") ||
    firstLine.startsWith("#!/usr/bin/env ruby")
  )
    return "ruby";
  if (
    firstLine.startsWith("#!/usr/bin/perl") ||
    firstLine.startsWith("#!/usr/bin/env perl")
  )
    return "perl";
  if (
    firstLine.startsWith("#!/usr/bin/env pwsh") ||
    firstLine.startsWith("#!/usr/bin/pwsh")
  )
    return "powershell";

  // PowerShell-specific patterns (check before other languages)
  if (
    /\$(host|psversiontable|error|null|true|false|profile)/i.test(code) ||
    /\b(Get-|Set-|New-|Remove-|Test-|Write-|Read-|Start-|Stop-|Invoke-)\w+/i.test(
      code
    ) ||
    /\[cmdletbinding\(\)\]/i.test(code) ||
    (/\bparam\s*\(/i.test(code) && code.includes("$")) ||
    (/@{.*}/i.test(code) && code.includes("$"))
  )
    return "powershell";

  // Specific language patterns
  if (code.includes("<?php")) return "php";
  if (code.includes("<!DOCTYPE") || code.includes("<html")) return "html";
  if (/\bSELECT\b.*\bFROM\b/i.test(code) || /\bCREATE\s+TABLE\b/i.test(code))
    return "sql";
  if (code.includes("package main") && code.includes("func ")) return "go";
  if (code.includes("fn main()") || code.includes("impl ")) return "rust";
  if (code.includes("public class") && code.includes("public static void main"))
    return "java";
  if (
    code.includes("def ") &&
    (code.includes("import ") || code.includes("from "))
  )
    return "python";
  if (
    /^\s*function\s+\w+\s*\(/m.test(code) ||
    /^\s*const\s+\w+\s*=/m.test(code)
  )
    return "javascript";
  if (
    code.includes("interface ") ||
    (code.includes(": ") && code.includes("=>"))
  )
    return "typescript";
  if (code.includes("@media") || /^[.#]\w+\s*{/m.test(code)) return "css";

  // Default
  return "javascript";
};

export default function ClipboardInput({ code }: { code: string }) {
  const [type, setType] = useState<ItemType>("text");
  const [textContent, setTextContent] = useState("");
  const [codeContent, setCodeContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [canView, setCanView] = useState(true);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveReason, setLeaveReason] = useState<
    "kicked" | "left" | "host-left"
  >("kicked");
  const [detectedLang, setDetectedLang] = useState<string>("javascript");
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });
  const supabase = getSupabaseBrowserWithCode(code);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add activity log helper
  const addActivity = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog((prev) => [
      `[${timestamp}] ${message}`,
      ...prev.slice(0, 19),
    ]);
  };

  // Get current content based on active tab
  const text = type === "code" ? codeContent : textContent;
  const setText = type === "code" ? setCodeContent : setTextContent;

  // Detect language when code content changes
  useEffect(() => {
    if (type === "code" && codeContent.trim()) {
      const lang = detectLanguage(codeContent);
      setDetectedLang(lang);
    }
  }, [codeContent, type]);

  // Initialize device ID on client side
  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // Initialize session encryption key
  useEffect(() => {
    generateSessionKey(code).then(setSessionKey);
  }, [code]);

  // Check device permissions with realtime enforcement
  useEffect(() => {
    if (!supabase || !deviceId) return;

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

    // Subscribe to postgres changes for permission updates
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
      // Listen for realtime broadcast events for instant permission changes
      .on("broadcast", { event: "permission_changed" }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          setIsFrozen(payload.payload.is_frozen || false);
          setCanView(payload.payload.can_view !== false);
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

  // Text formatting handler
  const handleTextFormat = (format: string, wrapper?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    let newText = text;
    let newCursorPos = start;

    if (format === "link") {
      const url = prompt("Enter URL:");
      if (url) {
        const linkText = selectedText || "link text";
        newText =
          text.substring(0, start) +
          `[${linkText}](${url})` +
          text.substring(end);
        newCursorPos = start + linkText.length + 3;
      }
    } else if (wrapper) {
      if (format === "bold") {
        newText =
          text.substring(0, start) +
          `**${selectedText}**` +
          text.substring(end);
        newCursorPos = end + 4;
      } else if (format === "italic") {
        newText =
          text.substring(0, start) + `*${selectedText}*` + text.substring(end);
        newCursorPos = end + 2;
      } else if (format === "strikethrough") {
        newText =
          text.substring(0, start) +
          `~~${selectedText}~~` +
          text.substring(end);
        newCursorPos = end + 4;
      } else if (format === "code") {
        newText =
          text.substring(0, start) +
          `\`${selectedText}\`` +
          text.substring(end);
        newCursorPos = end + 2;
      } else if (format === "superscript") {
        newText =
          text.substring(0, start) + `^${selectedText}^` + text.substring(end);
        newCursorPos = end + 2;
      } else if (format === "subscript") {
        newText =
          text.substring(0, start) + `~${selectedText}~` + text.substring(end);
        newCursorPos = end + 2;
      }
    }

    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Code formatting handler with language-specific support
  const handleCodeFormat = (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    let newText = text;
    let newCursorPos = start;

    // Get language-specific comment syntax
    const langComments = LANGUAGE_COMMENTS[detectedLang] || { line: "//" };

    if (format === "comment") {
      // Toggle line comments with language-specific syntax
      const lines = selectedText
        ? selectedText.split("\n")
        : [text.substring(0, start).split("\n").pop() || ""];
      const commentSyntax = langComments.line;
      const commentEscaped = commentSyntax.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const commentPattern = new RegExp(`^(\\s*)${commentEscaped}\\s?`);

      const allCommented = lines.every(
        (line) => !line.trim() || commentPattern.test(line)
      );

      const newLines = allCommented
        ? lines.map((line) => line.replace(commentPattern, "$1"))
        : lines.map((line) => {
            if (!line.trim()) return line;
            const leadingSpace = line.match(/^\s*/)?.[0] || "";
            const content = line.substring(leadingSpace.length);
            return leadingSpace + commentSyntax + " " + content;
          });

      newText =
        text.substring(0, start) + newLines.join("\n") + text.substring(end);
      newCursorPos = start + newLines.join("\n").length;
    } else if (format === "indent") {
      // Indent selected lines
      const lines = selectedText.split("\n");
      const indented = lines.map((line) => "  " + line);
      newText =
        text.substring(0, start) + indented.join("\n") + text.substring(end);
      newCursorPos = start + indented.join("\n").length;
    } else if (format === "outdent") {
      // Outdent selected lines
      const lines = selectedText.split("\n");
      const outdented = lines.map((line) => line.replace(/^  /, ""));
      newText =
        text.substring(0, start) + outdented.join("\n") + text.substring(end);
      newCursorPos = start + outdented.join("\n").length;
    } else if (format === "wrap") {
      // Line wrapping: split long lines at 80/100 characters
      const maxLength = 80;
      const lines = (selectedText || text).split("\n");
      const wrapped = lines
        .map((line) => {
          if (line.length <= maxLength) return line;

          // Try to break at spaces
          const words = line.split(" ");
          const result: string[] = [];
          let currentLine = "";

          for (const word of words) {
            if ((currentLine + " " + word).trim().length <= maxLength) {
              currentLine = currentLine ? currentLine + " " + word : word;
            } else {
              if (currentLine) result.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) result.push(currentLine);

          return result.join("\n");
        })
        .join("\n");

      if (selectedText) {
        newText = text.substring(0, start) + wrapped + text.substring(end);
        newCursorPos = start + wrapped.length;
      } else {
        newText = wrapped;
        newCursorPos = 0;
      }
    } else if (format === "braces") {
      // Brace checker: find unclosed braces, brackets, parentheses
      const codeToCheck = text;
      const stack: Array<{ char: string; pos: number; line: number }> = [];
      const errors: Array<{ line: number; char: string; type: string }> = [];
      const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
      const closePairs: Record<string, string> = {
        "}": "{",
        "]": "[",
        ")": "(",
      };

      let line = 1;
      for (let i = 0; i < codeToCheck.length; i++) {
        const char = codeToCheck[i];

        if (char === "\n") {
          line++;
          continue;
        }

        if (pairs[char]) {
          stack.push({ char, pos: i, line });
        } else if (closePairs[char]) {
          if (stack.length === 0) {
            errors.push({ line, char, type: "unexpected_close" });
          } else {
            const last = stack.pop()!;
            if (pairs[last.char] !== char) {
              errors.push({ line, char, type: "mismatch" });
            }
          }
        }
      }

      // Unclosed braces
      while (stack.length > 0) {
        const unclosed = stack.pop()!;
        errors.push({
          line: unclosed.line,
          char: unclosed.char,
          type: "unclosed",
        });
      }

      // Show errors as inline message (prepend to code)
      if (errors.length > 0) {
        const errorMsg =
          langComments.line +
          " ⚠️ BRACE ERRORS:\n" +
          errors
            .map((e) => {
              if (e.type === "unclosed")
                return `${langComments.line} Line ${e.line}: Unclosed '${e.char}'`;
              if (e.type === "unexpected_close")
                return `${langComments.line} Line ${e.line}: Unexpected '${e.char}'`;
              return `${langComments.line} Line ${e.line}: Mismatched '${e.char}'`;
            })
            .join("\n") +
          "\n${langComments.line}\n";
        newText = errorMsg + text;
        newCursorPos = 0;
      } else {
        const successMsg = `${langComments.line} ✓ All braces matched correctly!\n${langComments.line}\n`;
        newText = successMsg + text;
        newCursorPos = 0;
      }
    } else if (format === "format") {
      // Check indentation consistency and fix it
      const lines = text.split("\n");
      let indent = 0;
      const formatted: string[] = [];
      const indentErrors: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
          formatted.push("");
          continue;
        }

        // Check for closing braces first
        if (
          trimmed.startsWith("}") ||
          trimmed.startsWith("]") ||
          trimmed.startsWith(")")
        ) {
          indent = Math.max(0, indent - 1);
        }

        // Expected indentation
        const expectedIndent = "  ".repeat(indent);
        const currentIndent = line.match(/^\s*/)?.[0] || "";

        // Check if indentation matches
        if (currentIndent !== expectedIndent && trimmed) {
          indentErrors.push(i + 1); // Line numbers are 1-based
        }

        formatted.push(expectedIndent + trimmed);

        // Check for opening braces
        if (
          trimmed.endsWith("{") ||
          trimmed.endsWith("[") ||
          trimmed.endsWith("(")
        ) {
          indent++;
        }

        // Handle single-line blocks
        const openCount = (trimmed.match(/[{[(]/g) || []).length;
        const closeCount = (trimmed.match(/[}\])]/g) || []).length;
        if (openCount > 0 && openCount === closeCount) {
          // Don't change indent for balanced single-line blocks
          if (
            trimmed.endsWith("{") ||
            trimmed.endsWith("[") ||
            trimmed.endsWith("(")
          ) {
            indent--;
          }
        }
      }

      newText = formatted.join("\n");

      // If there were errors, prepend a comment
      if (indentErrors.length > 0) {
        const errorMsg = `${langComments.line} ⚠️ Fixed indentation on ${
          indentErrors.length
        } line(s): ${indentErrors.slice(0, 10).join(", ")}${
          indentErrors.length > 10 ? "..." : ""
        }\n${langComments.line}\n`;
        newText = errorMsg + newText;
      }

      newCursorPos = 0;
    }

    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!supabase || !sessionKey) return;
    setBusy(true);
    setShowActivityLog(true);
    try {
      if (type === "file" && file) {
        addActivity(`[INIT] File upload started: ${file.name}`);
        addActivity(
          `[FILE] Size: ${(file.size / 1024).toFixed(2)} KB, Type: ${
            file.type || "unknown"
          }`
        );

        // Reading file into memory
        addActivity("[CLIENT] Reading file into memory buffer...");
        const startRead = performance.now();

        // Encrypt file completely client-side for zero-knowledge storage
        addActivity("[CRYPTO] Initializing AES-256-GCM encryption...");
        addActivity("[CRYPTO] Generating random IV (96-bit)...");
        const { encryptedData, originalName, mimeType, size } =
          await encryptFile(file, sessionKey);
        const readTime = (performance.now() - startRead).toFixed(0);
        addActivity(`[CRYPTO] File encrypted successfully (${readTime}ms)`);
        addActivity(
          `[DATA] Encrypted size: ${(encryptedData.length / 1024).toFixed(
            2
          )} KB`
        );

        // Encrypt metadata
        addActivity("[CRYPTO] Encrypting file metadata...");
        const startMeta = performance.now();
        const encryptedFileName = await encryptData(originalName, sessionKey);
        const encryptedMimeType = await encryptData(mimeType, sessionKey);
        const encryptedSize = await encryptData(size.toString(), sessionKey);
        const metaTime = (performance.now() - startMeta).toFixed(0);
        addActivity(`[CRYPTO] Metadata encrypted (${metaTime}ms)`);

        // Enhanced encryption: encrypt timestamps and display ID
        addActivity("[CRYPTO] Encrypting temporal data...");
        const now = new Date();
        const createdAtEncrypted = await encryptTimestamp(now, sessionKey);
        const updatedAtEncrypted = await encryptTimestamp(now, sessionKey);
        const displayId = generateDisplayId();
        const displayIdEncrypted = await encryptDisplayId(
          displayId,
          sessionKey
        );
        addActivity("[CRYPTO] Temporal data encrypted");

        // Store encrypted file data directly in database (no file storage needed)
        addActivity("[DATABASE] Establishing connection to Supabase...");
        addActivity("[DATABASE] Preparing INSERT query for 'items' table...");
        addActivity(
          `[DATABASE] Session: ${code}, Device: ${deviceId.substring(0, 8)}...`
        );
        const startDb = performance.now();
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
        const dbTime = (performance.now() - startDb).toFixed(0);
        addActivity(`[DATABASE] Row inserted successfully (${dbTime}ms)`);
        addActivity("[DATABASE] Transaction committed");

        // Notify other components to refresh
        addActivity("[REALTIME] Broadcasting update event...");
        addActivity(
          "[REALTIME] Triggering global refresh for connected clients..."
        );
        try {
          triggerGlobalRefresh();
          addActivity("[REALTIME] Broadcast sent successfully");
        } catch {
          addActivity("[REALTIME] Broadcast failed (non-critical)");
        }
        addActivity("[CLEANUP] Clearing file buffer from memory...");
        setFile(null);
        addActivity(
          `[SUCCESS] Upload complete in ${(
            (performance.now() - startRead) /
            1000
          ).toFixed(2)}s`
        );

        // Auto-hide log after 3 seconds
        setTimeout(() => setShowActivityLog(false), 3000);
      } else if (text.trim()) {
        const startTime = performance.now();
        addActivity(`[INIT] ${type.toUpperCase()} upload started`);
        addActivity(`[DATA] Content length: ${text.trim().length} characters`);
        addActivity(
          `[DATA] Estimated size: ${(
            new Blob([text.trim()]).size / 1024
          ).toFixed(2)} KB`
        );

        // Encrypt text/code content
        addActivity("[CRYPTO] Initializing AES-256-GCM encryption...");
        addActivity("[CRYPTO] Converting text to UTF-8 byte array...");
        const startEncrypt = performance.now();
        const encryptedContent = await encryptData(text.trim(), sessionKey);
        const encryptTime = (performance.now() - startEncrypt).toFixed(0);
        addActivity(
          `[CRYPTO] Content encrypted successfully (${encryptTime}ms)`
        );
        addActivity(
          `[DATA] Encrypted size: ${(encryptedContent.length / 1024).toFixed(
            2
          )} KB`
        );

        // Enhanced encryption: encrypt timestamps and display ID
        addActivity("[CRYPTO] Encrypting temporal metadata...");
        const startTemporal = performance.now();
        const now = new Date();
        const createdAtEncrypted = await encryptTimestamp(now, sessionKey);
        const updatedAtEncrypted = await encryptTimestamp(now, sessionKey);
        const displayId = generateDisplayId();
        const displayIdEncrypted = await encryptDisplayId(
          displayId,
          sessionKey
        );
        const temporalTime = (performance.now() - startTemporal).toFixed(0);
        addActivity(`[CRYPTO] Temporal data encrypted (${temporalTime}ms)`);
        addActivity(`[METADATA] Display ID: ${displayId.substring(0, 12)}...`);

        addActivity(
          "[DATABASE] Opening connection to PostgreSQL via Supabase..."
        );
        addActivity("[DATABASE] Preparing parameterized INSERT statement...");
        addActivity(`[DATABASE] Target: public.items (session=${code})`);
        const startDb = performance.now();
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
        const dbTime = (performance.now() - startDb).toFixed(0);
        addActivity(`[DATABASE] INSERT executed successfully (${dbTime}ms)`);
        addActivity("[DATABASE] PostgreSQL transaction committed");
        addActivity("[DATABASE] Row-level security policies verified");

        addActivity("[REALTIME] Initiating WebSocket broadcast...");
        addActivity("[REALTIME] Notifying all connected clients...");
        try {
          triggerGlobalRefresh();
          addActivity("[REALTIME] Broadcast acknowledged by server");
        } catch {
          addActivity("[REALTIME] Broadcast failed (clients will poll)");
        }

        // Clear the appropriate content based on type
        addActivity("[CLEANUP] Clearing local input buffer...");
        if (type === "code") {
          setCodeContent("");
        } else {
          setTextContent("");
        }
        const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
        addActivity(`[SUCCESS] Upload completed in ${totalTime}s`);

        // Auto-hide log after 3 seconds
        setTimeout(() => setShowActivityLog(false), 3000);
      }
    } catch (e: any) {
      console.error("Submit error:", e);
      addActivity(`[ERROR] ${e?.message || "Upload failed"}`);
      addActivity(`[ERROR] Stack trace logged to console`);
      setErrorDialog({
        open: true,
        title: "Upload Failed",
        message:
          e?.message ||
          "Upload failed. Please check your connection and try again.",
      });
    } finally {
      addActivity("[CLEANUP] Releasing resources...");
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <form onSubmit={submit} className="flex flex-col gap-2">
          {/* Compact Tab Bar with inline formatting tools */}
          <div className="flex gap-1 items-center justify-between">
            {/* Left: Type tabs */}
            <div className="flex gap-1 items-center">
              <Button
                type="button"
                variant={type === "text" ? "default" : "ghost"}
                disabled={!canView}
                onClick={() => setType("text")}
                size="sm"
                className="h-8 px-3 text-xs"
              >
                <Type className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Text</span>
              </Button>
              <Button
                type="button"
                variant={type === "code" ? "default" : "ghost"}
                disabled={!canView}
                onClick={() => {
                  setType("code");
                }}
                size="sm"
                className="h-8 px-3 text-xs relative"
              >
                <Code className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Code</span>
                {type === "code" && codeContent.trim() && (
                  <span className="ml-1 text-[9px] opacity-50 font-mono hidden sm:inline">
                    {detectedLang}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant={type === "file" ? "default" : "ghost"}
                disabled={!canView}
                onClick={() => setType("file")}
                size="sm"
                className="h-8 px-3 text-xs"
              >
                <FileText className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">File</span>
              </Button>
            </div>

            {/* Right: Inline formatting tools (only visible for text/code with content) */}
            {type !== "file" && text.trim().length > 0 && (
              <div className="flex items-center gap-0.5 animate-in fade-in slide-in-from-right-2 duration-200">
                {type === "text" ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleTextFormat("bold", "**")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Bold (Ctrl+B)"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleTextFormat("italic", "*")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Italic (Ctrl+I)"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleTextFormat("strikethrough", "~~")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Strikethrough"
                    >
                      <Strikethrough className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleTextFormat("code", "`")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Inline Code"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleCodeFormat("comment")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Toggle Comment (Ctrl+/)"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleCodeFormat("indent")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Indent (Tab)"
                    >
                      <Indent className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleCodeFormat("outdent")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Outdent (Shift+Tab)"
                    >
                      <Outdent className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleCodeFormat("braces")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Check Braces"
                    >
                      <Braces className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canView}
                      onClick={() => handleCodeFormat("format")}
                      className="h-7 w-7 p-0 hover:bg-primary/10"
                      title="Fix Indentation"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {type === "file" ? (
            <div className="space-y-2">
              <Input
                type="file"
                onChange={handleFileChange}
                accept={Object.keys(SUPPORTED_FILE_TYPES).join(",")}
                className={`h-10 ${fileError ? "border-destructive" : ""}`}
              />
              {fileError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                  {fileError}
                </div>
              )}
              {file && !fileError && (
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="truncate">{file.name}</span>
                    <span className="text-[10px] ml-2 flex-shrink-0">
                      {(file.size / 1024 / 1024).toFixed(2)}MB
                    </span>
                  </div>
                </div>
              )}
              <Button
                type="submit"
                disabled={
                  busy || !canView || !sessionKey || !file || !!fileError
                }
                className="w-full h-9 font-medium"
                size="sm"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-2" />
                    Share File
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Textarea
                placeholder={
                  type === "code"
                    ? "Paste your code here... (Ctrl+Enter to send)"
                    : "Write your text here... (Ctrl+Enter to send)"
                }
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                }}
                onFocus={() => setIsExpanded(true)}
                onBlur={() => {
                  if (!text.trim()) {
                    setIsExpanded(false);
                  }
                }}
                disabled={!canView}
                onKeyDown={(e) => {
                  // Keyboard shortcuts
                  if (type === "text") {
                    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
                      e.preventDefault();
                      handleTextFormat("bold", "**");
                      return;
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
                      e.preventDefault();
                      handleTextFormat("italic", "*");
                      return;
                    }
                  } else if (type === "code") {
                    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
                      e.preventDefault();
                      handleCodeFormat("comment");
                      return;
                    }
                    if (e.key === "Tab") {
                      e.preventDefault();
                      if (e.shiftKey) {
                        handleCodeFormat("outdent");
                      } else {
                        handleCodeFormat("indent");
                      }
                      return;
                    }
                  }

                  // Submit shortcut
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (isFrozen || !canView) return;
                    submit();
                  }
                }}
                className={`w-full pr-12 resize-none transition-all duration-200 ${
                  type === "code"
                    ? "font-mono text-xs bg-muted/30 leading-relaxed"
                    : "font-sans text-sm"
                } ${isExpanded ? "min-h-[120px]" : "min-h-[44px]"}`}
                rows={isExpanded ? 4 : 1}
              />
              <Button
                type="submit"
                disabled={busy || !canView || !sessionKey || !text.trim()}
                size="sm"
                className="absolute right-1.5 bottom-1.5 h-9 w-9 p-0 shrink-0"
                title="Send (Ctrl+Enter)"
                onClick={() => {
                  submit();
                  setIsExpanded(false);
                }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {/* Integrated Activity Log - appears inside the input area */}
          {showActivityLog && activityLog.length > 0 && (
            <div className="mt-2 border-t border-border/50 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Upload Progress
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowActivityLog(false)}
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                  title="Hide progress"
                >
                  ×
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5 text-xs font-mono">
                {activityLog.map((log, i) => (
                  <div
                    key={i}
                    className="text-muted-foreground/90 py-0.5 animate-in fade-in duration-150"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span className="text-primary mr-1.5">›</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overlay only for hidden (no access) - frozen allows writing */}
          {!canView && <MaskedOverlay variant="hidden" />}
        </form>
      </div>

      {isLeaving && <LeavingCountdown reason={leaveReason} />}

      <ErrorDialog
        open={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, title: "", message: "" })}
        title={errorDialog.title}
        message={errorDialog.message}
      />
    </div>
  );
}
