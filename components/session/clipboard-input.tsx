"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Hash,
  Indent,
  Outdent,
  Braces,
  Code2,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Subscript,
  Superscript,
  MonitorDot,
  Minimize2,
  Maximize2,
  WrapText,
  Languages,
  Sparkles,
  RefreshCw,
  Pause,
  Play,
  Timer,
} from "lucide-react";
import MaskedOverlay from "@/components/ui/masked-overlay";
import { triggerGlobalRefresh } from "@/lib/globalRefresh";
import { useHistoryControls } from "./history-controls-context";
import ExportHistoryButton from "./export-history-button";
import LeavingCountdown from "./leaving-countdown";
import TextFormattingToolbar from "./text-formatting-toolbar";
import CodeFormattingToolbar from "./code-formatting-toolbar";
import { ErrorDialog } from "@/components/ui/error-dialog";
import * as prettier from "prettier/standalone";
import * as prettierBabel from "prettier/plugins/babel";
import * as prettierEstree from "prettier/plugins/estree";
import * as prettierHtml from "prettier/plugins/html";
import * as prettierCss from "prettier/plugins/postcss";
import * as prettierTypescript from "prettier/plugins/typescript";

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

// History Control Bar Component
function HistoryControlBar() {
  const controls = useHistoryControls();

  const getConnectionStatusColor = () => {
    switch (controls.connectionStatus) {
      case "connected":
        return "bg-green-300";
      case "connecting":
        return "bg-yellow-300";
      case "disconnected":
        return "bg-red-300";
      default:
        return "bg-gray-300";
    }
  };

  const formatTimeInterval = (ms: number) => {
    if (ms >= 60000) return `${ms / 60000}m`;
    if (ms >= 1000) return `${ms / 1000}s`;
    return `${ms}ms`;
  };

  return (
    <div className="bg-primary border-t border-primary/20 backdrop-blur-md shadow-lg flex items-center justify-between px-3 py-0.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${getConnectionStatusColor()}`}
          />
          <span className="text-[10px] font-medium text-white">
            {controls.itemsCount} {controls.itemsCount === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {/* Export Button */}
        {controls.exportEnabled && controls.canExport && controls.isHost && (
          <ExportHistoryButton
            sessionCode={controls.sessionCode}
            canExport={controls.canExport}
            isHost={controls.isHost}
          />
        )}

        {/* Pause/Play Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.toggleAutoRefresh}
          className="h-5 w-5 p-0 text-white hover:bg-white/20 rounded"
          title={
            controls.autoRefreshEnabled
              ? "Pause auto-refresh"
              : "Resume auto-refresh"
          }
        >
          {controls.autoRefreshEnabled ? (
            <Pause className="h-2.5 w-2.5" />
          ) : (
            <Play className="h-2.5 w-2.5" />
          )}
        </Button>

        {/* Manual Refresh Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.handleManualRefresh}
          disabled={controls.isRefreshing}
          className={`h-5 w-5 p-0 rounded ${
            controls.isRefreshing
              ? "text-blue-300 animate-spin"
              : "text-white hover:bg-white/20"
          }`}
          title="Manual refresh"
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </Button>

        {/* Timer Interval Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.cycleTimeInterval}
          className="h-5 px-1.5 gap-1 text-white hover:bg-white/20 rounded"
          title="Change refresh interval"
        >
          <Timer className="h-2.5 w-2.5" />
          <span className="text-[10px] font-medium">
            {formatTimeInterval(controls.autoRefreshInterval)}
          </span>
        </Button>
      </div>
    </div>
  );
}

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
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Simple markdown renderer for real-time preview
  const renderMarkdown = (text: string) => {
    if (!text) return "";

    let html = text;

    // Headers (must be at start of line)
    html = html.replace(
      /^### (.+)$/gm,
      '<h3 class="text-lg font-bold">$1</h3>'
    );
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Underline
    html = html.replace(/<u>(.+?)<\/u>/g, "<u>$1</u>");

    // Inline code/monospace
    html = html.replace(
      /`(.+?)`/g,
      '<code class="bg-muted px-1 rounded text-sm font-mono">$1</code>'
    );

    // Superscript
    html = html.replace(/\^(.+?)\^/g, "<sup>$1</sup>");

    // Subscript
    html = html.replace(/~(.+?)~/g, "<sub>$1</sub>");

    // Convert newlines to <br>
    html = html.replace(/\n/g, "<br>");

    return html;
  };

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
    } else if (format === "bold") {
      newText =
        text.substring(0, start) + `**${selectedText}**` + text.substring(end);
      newCursorPos = end + 4;
    } else if (format === "italic") {
      newText =
        text.substring(0, start) + `*${selectedText}*` + text.substring(end);
      newCursorPos = end + 2;
    } else if (format === "strikethrough") {
      newText =
        text.substring(0, start) + `~~${selectedText}~~` + text.substring(end);
      newCursorPos = end + 4;
    } else if (format === "underline") {
      newText =
        text.substring(0, start) +
        `<u>${selectedText}</u>` +
        text.substring(end);
      newCursorPos = end + 7;
    } else if (format === "code") {
      newText =
        text.substring(0, start) + `\`${selectedText}\`` + text.substring(end);
      newCursorPos = end + 2;
    } else if (format === "monospace") {
      newText =
        text.substring(0, start) + `\`${selectedText}\`` + text.substring(end);
      newCursorPos = end + 2;
    } else if (format === "superscript") {
      newText =
        text.substring(0, start) + `^${selectedText}^` + text.substring(end);
      newCursorPos = end + 2;
    } else if (format === "subscript") {
      newText =
        text.substring(0, start) + `~${selectedText}~` + text.substring(end);
      newCursorPos = end + 2;
    } else if (format === "h1") {
      newText =
        text.substring(0, start) + `# ${selectedText}` + text.substring(end);
      newCursorPos = end + 2;
    } else if (format === "h2") {
      newText =
        text.substring(0, start) + `## ${selectedText}` + text.substring(end);
      newCursorPos = end + 3;
    } else if (format === "h3") {
      newText =
        text.substring(0, start) + `### ${selectedText}` + text.substring(end);
      newCursorPos = end + 4;
    } else if (format === "paragraph") {
      // Remove any heading markers
      const cleanedText = selectedText.replace(/^#+\s*/, "");
      newText = text.substring(0, start) + cleanedText + text.substring(end);
      newCursorPos = start + cleanedText.length;
    }

    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Code formatting handler with language-specific support
  const handleCodeFormat = async (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    let newText = text;
    let newCursorPos = start;

    // Get language-specific comment syntax
    const langComments = LANGUAGE_COMMENTS[detectedLang] || { line: "//" };

    if (format === "prettify") {
      // Use Prettier for proper formatting
      try {
        const parserMap: Record<string, string> = {
          javascript: "babel",
          typescript: "typescript",
          json: "json",
          html: "html",
          css: "css",
          jsx: "babel",
          tsx: "typescript",
        };

        const parser = parserMap[detectedLang] || "babel";
        const plugins: any[] = [
          prettierBabel,
          prettierEstree,
          prettierHtml,
          prettierCss,
          prettierTypescript,
        ];

        newText = await prettier.format(text, {
          parser,
          plugins,
          semi: true,
          singleQuote: false,
          tabWidth: 2,
          trailingComma: "es5",
        });
        newCursorPos = 0;
      } catch (error) {
        console.error("Prettier formatting failed:", error);
        // Fallback to basic formatting
        newText = text
          .split("\n")
          .map((line) => line.trim())
          .join("\n");
        newCursorPos = 0;
      }
    } else if (format === "comment") {
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
    } else if (format === "minify") {
      // MINIFY: Strip ALL whitespace, newlines, comments
      let minified = text;

      // Remove all line comments (but protect strings)
      minified = minified
        .split("\n")
        .map((line) => {
          let inString = false;
          let stringChar = "";
          let result = "";

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            // Track string state
            if (
              (char === '"' || char === "'" || char === "`") &&
              line[i - 1] !== "\\"
            ) {
              if (!inString) {
                inString = true;
                stringChar = char;
              } else if (char === stringChar) {
                inString = false;
                stringChar = "";
              }
            }

            // Remove comments outside strings
            if (!inString && char === "/" && nextChar === "/") {
              break; // Rest of line is comment
            }

            result += char;
          }
          return result;
        })
        .join("\n");

      // Remove multi-line comments /* */
      minified = minified.replace(/\/\*[\s\S]*?\*\//g, "");

      // Remove ALL whitespace and newlines (except in strings)
      let result = "";
      let inString = false;
      let stringChar = "";

      for (let i = 0; i < minified.length; i++) {
        const char = minified[i];

        // Track string state
        if (
          (char === '"' || char === "'" || char === "`") &&
          minified[i - 1] !== "\\"
        ) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = "";
          }
        }

        // Keep whitespace in strings, remove everywhere else
        if (inString) {
          result += char;
        } else if (!/\s/.test(char)) {
          result += char;
        }
      }

      newText = result;
      newCursorPos = 0;
    } else if (format === "lowercase") {
      // Convert selected text or all to lowercase
      if (selectedText) {
        newText =
          text.substring(0, start) +
          selectedText.toLowerCase() +
          text.substring(end);
        newCursorPos = start + selectedText.toLowerCase().length;
      } else {
        newText = text.toLowerCase();
        newCursorPos = 0;
      }
    } else if (format === "uppercase") {
      // Convert selected text or all to uppercase
      if (selectedText) {
        newText =
          text.substring(0, start) +
          selectedText.toUpperCase() +
          text.substring(end);
        newCursorPos = start + selectedText.toUpperCase().length;
      } else {
        newText = text.toUpperCase();
        newCursorPos = 0;
      }
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

        // Collapse input panel after successful send
        setIsFocused(false);
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

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFocused &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        textareaRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFocused]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out"
      ref={containerRef}
    >
      {/* Backdrop when focused */}
      {isFocused && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setIsFocused(false);
            textareaRef.current?.blur();
          }}
        />
      )}

      {/* History Control Bar - Above input panel */}
      <HistoryControlBar />

      <div
        className={`
          bg-gradient-to-b from-background/95 to-background border-t border-primary/10 shadow-2xl
          transition-all duration-300 ease-out backdrop-blur-xl
          ${isFocused ? "h-[70vh]" : "h-auto"}
        `}
      >
        <form onSubmit={submit} className="h-full flex flex-col">
          {/* Single Row: Fixed Tabs (Left) + Scrollable Formatting (Right) */}
          <div className="shrink-0 px-3 py-2 border-b border-primary/10 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent flex items-center gap-3">
            {/* Left: Fixed Tab Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                disabled={!canView}
                onClick={() => setType("text")}
                size="sm"
                className={`h-8 px-3 text-xs font-semibold rounded transition-all duration-200 ${
                  type === "text"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                    : "hover:bg-primary/10 hover:scale-105"
                }`}
              >
                <Type className="h-3.5 w-3.5 mr-1.5" />
                Text
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!canView}
                onClick={() => setType("code")}
                size="sm"
                className={`h-8 px-3 text-xs font-semibold rounded transition-all duration-200 ${
                  type === "code"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                    : "hover:bg-primary/10 hover:scale-105"
                }`}
              >
                <Code className="h-3.5 w-3.5 mr-1.5" />
                Code
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!canView}
                onClick={() => setType("file")}
                size="sm"
                className={`h-8 px-3 text-xs font-semibold rounded transition-all duration-200 ${
                  type === "file"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                    : "hover:bg-primary/10 hover:scale-105"
                }`}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                File
              </Button>
            </div>

            {/* Separator */}
            {type !== "file" && isFocused && (
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-primary/20 to-transparent shrink-0" />
            )}

            {/* Right: Scrollable Formatting Toolbar */}
            {type !== "file" && isFocused && (
              <div className="flex-1 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1.5 min-w-max">
                  {type === "text" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("bold")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Bold (Ctrl+B)"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("italic")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Italic (Ctrl+I)"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("underline")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Underline"
                      >
                        <Underline className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("strikethrough")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Strikethrough"
                      >
                        <Strikethrough className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("monospace")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Monospace"
                      >
                        <MonitorDot className="h-3.5 w-3.5" />
                      </Button>
                      <div className="w-px h-5 bg-linear-to-b from-transparent via-primary/20 to-transparent mx-1 shrink-0" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("h1")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Heading 1"
                      >
                        <Heading1 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("h2")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Heading 2"
                      >
                        <Heading2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("h3")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Heading 3"
                      >
                        <Heading3 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : type === "code" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("comment")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Comment (Ctrl+/)"
                      >
                        <Hash className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("indent")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
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
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Outdent (Shift+Tab)"
                      >
                        <Outdent className="h-3.5 w-3.5" />
                      </Button>
                      <div className="w-px h-5 bg-linear-to-b from-transparent via-primary/20 to-transparent mx-1 shrink-0" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("braces")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Check Braces"
                      >
                        <Braces className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("prettify")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Prettify (Format with Prettier)"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("minify")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Minify (Remove Whitespace)"
                      >
                        <Minimize2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("wrap")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="Wrap Long Lines"
                      >
                        <WrapText className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("uppercase")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="UPPERCASE"
                      >
                        <span className="text-[10px] font-bold">AA</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("lowercase")}
                        className="h-7 w-7 p-0 rounded shrink-0 hover:bg-primary/15 hover:scale-110 transition-all"
                        title="lowercase"
                      >
                        <span className="text-[10px] font-bold">aa</span>
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {/* Language detector badge (right side when not focused) */}
            {type === "code" && codeContent.trim() && !isFocused && (
              <div className="flex-1" />
            )}
            {type === "code" && codeContent.trim() && !isFocused && (
              <Badge
                variant="outline"
                className="h-6 px-3 text-[10px] font-mono shrink-0 bg-primary/5 border-primary/20 backdrop-blur-sm rounded"
              >
                <Languages className="h-3 w-3 mr-1.5" />
                {detectedLang}
              </Badge>
            )}
          </div>

          {/* Main Input Area - Flex grows to take available space */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {type === "file" ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <label
                  htmlFor="file-upload"
                  className={`
                    w-full max-w-md flex flex-col items-center justify-center
                    min-h-[180px] p-6 rounded border-2 border-dashed
                    cursor-pointer transition-all duration-200
                    ${
                      fileError
                        ? "border-destructive bg-destructive/5"
                        : file
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary hover:bg-muted/30"
                    }
                  `}
                >
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileChange}
                    accept={Object.keys(SUPPORTED_FILE_TYPES).join(",")}
                    className="hidden"
                  />
                  {file && !fileError ? (
                    <div className="text-center w-full space-y-3">
                      <FileText className="h-12 w-12 text-primary mx-auto" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium truncate max-w-full px-4">
                          {file.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setFile(null);
                          setFileError(null);
                        }}
                        className="h-8 px-4 rounded-full text-xs"
                      >
                        Change File
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Tap to choose a file
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Maximum size: 5MB
                        </div>
                      </div>
                    </div>
                  )}
                </label>
                {fileError && (
                  <div className="absolute bottom-20 left-4 right-4 text-xs text-destructive bg-destructive/10 p-3 rounded flex items-start gap-2 border border-destructive/20">
                    <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 relative flex flex-col">
                <Textarea
                  placeholder={
                    type === "code"
                      ? "Paste or type your code here..."
                      : "Type your message..."
                  }
                  ref={textareaRef}
                  value={text}
                  onFocus={() => setIsFocused(true)}
                  onChange={(e) => {
                    setText(e.target.value);
                  }}
                  disabled={!canView || isFrozen}
                  onKeyDown={(e) => {
                    // Keyboard shortcuts
                    if (type === "text") {
                      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
                        e.preventDefault();
                        handleTextFormat("bold");
                        return;
                      }
                      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
                        e.preventDefault();
                        handleTextFormat("italic");
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
                  className={`
                      flex-1 w-full resize-none border-0
                      focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0
                      ${type === "code" ? "font-mono text-sm leading-[1.5]" : "text-base"}
                      p-4 pb-14 bg-transparent
                      scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent
                    `}
                />

                {/* Send button inside textarea - bottom right */}
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {text.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setText("")}
                      className="h-8 px-3 rounded-full text-xs"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={busy || !canView || !sessionKey || !text.trim()}
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full shadow-lg"
                    title="Send (Ctrl+Enter)"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Only for file type */}
          {type === "file" && (
            <div className="shrink-0 px-4 py-3 border-t border-primary/10 bg-gradient-to-r from-primary/5 to-transparent backdrop-blur-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {file && !fileError && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="font-semibold text-primary">
                      File ready
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {file && !fileError && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setFileError(null);
                    }}
                    className="h-9 px-4 rounded text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={
                    busy || !canView || !sessionKey || !file || !!fileError
                  }
                  size="sm"
                  className="h-9 px-6 rounded text-xs font-semibold shadow-lg shadow-primary/25 hover:scale-105 transition-all"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Activity Log - Overlay */}
          {showActivityLog && activityLog.length > 0 && (
            <div className="absolute bottom-16 left-4 right-4 border rounded p-3 bg-background/95 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-medium">Activity Log</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowActivityLog(false)}
                  className="h-6 w-6 p-0 rounded-full"
                >
                  ×
                </Button>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 text-[10px] font-mono scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                {activityLog.slice(0, 5).map((log, i) => (
                  <div key={i} className="text-muted-foreground">
                    <span className="text-primary mr-1">›</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overlay for frozen/no access */}
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
