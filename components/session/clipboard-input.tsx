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
  Eye,
  Copy,
  Check,
  AlertTriangle,
  Eraser,
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
  javascript: { line: "//", block: { start: "/*", end: "*/" } },
  typescript: { line: "//", block: { start: "/*", end: "*/" } },
  jsx: { line: "//", block: { start: "/*", end: "*/" } },
  tsx: { line: "//", block: { start: "/*", end: "*/" } },
  json: { line: "//" },

  // Backend languages
  python: { line: "#", block: { start: '"""', end: '"""' } },
  java: { line: "//", block: { start: "/*", end: "*/" } },
  go: { line: "//", block: { start: "/*", end: "*/" } },
  rust: { line: "//", block: { start: "/*", end: "*/" } },
  php: { line: "//", block: { start: "/*", end: "*/" } },
  lua: { line: "--", block: { start: "--[[", end: "]]" } },
  r: { line: "#" },
  dart: { line: "//", block: { start: "/*", end: "*/" } },
  elixir: { line: "#" },
  erlang: { line: "%" },
  clojure: { line: ";" },
  lisp: { line: ";" },
  scheme: { line: ";" },
  ocaml: { line: "(*", block: { start: "(*", end: "*)" } },
  fsharp: { line: "//", block: { start: "(*", end: "*)" } },
  nim: { line: "#", block: { start: "#[", end: "]#" } },
  zig: { line: "//" },
  v: { line: "//", block: { start: "/*", end: "*/" } },

  // Systems programming
  c: { line: "//", block: { start: "/*", end: "*/" } },
  cpp: { line: "//", block: { start: "/*", end: "*/" } },
  csharp: { line: "//", block: { start: "/*", end: "*/" } },
  objectivec: { line: "//", block: { start: "/*", end: "*/" } },
  d: { line: "//", block: { start: "/*", end: "*/" } },

  // Scripting languages
  bash: { line: "#" },
  zsh: { line: "#" },
  powershell: { line: "#", block: { start: "<#", end: "#>" } },
  shell: { line: "#" },
  ruby: { line: "#", block: { start: "=begin", end: "=end" } },
  perl: { line: "#", block: { start: "=pod", end: "=cut" } },
  tcl: { line: "#" },
  awk: { line: "#" },

  // Database
  sql: { line: "--", block: { start: "/*", end: "*/" } },
  plsql: { line: "--", block: { start: "/*", end: "*/" } },
  tsql: { line: "--", block: { start: "/*", end: "*/" } },

  // Web
  html: { line: "<!--", block: { start: "<!--", end: "-->" } },
  css: { line: "/*", block: { start: "/*", end: "*/" } },
  xml: { line: "<!--", block: { start: "<!--", end: "-->" } },
  scss: { line: "//", block: { start: "/*", end: "*/" } },
  sass: { line: "//" },
  less: { line: "//", block: { start: "/*", end: "*/" } },
  vue: { line: "//", block: { start: "/*", end: "*/" } },
  svelte: { line: "//", block: { start: "/*", end: "*/" } },

  // Mobile
  swift: { line: "//", block: { start: "/*", end: "*/" } },
  kotlin: { line: "//", block: { start: "/*", end: "*/" } },

  // JVM languages
  scala: { line: "//", block: { start: "/*", end: "*/" } },
  groovy: { line: "//", block: { start: "/*", end: "*/" } },

  // Functional
  haskell: { line: "--", block: { start: "{-", end: "-}" } },
  elm: { line: "--", block: { start: "{-", end: "-}" } },
  purescript: { line: "--", block: { start: "{-", end: "-}" } },

  // Scientific
  matlab: { line: "%", block: { start: "%{", end: "%}" } },
  julia: { line: "#", block: { start: "#=", end: "=#" } },
  fortran: { line: "!" },

  // Config
  yaml: { line: "#" },
  toml: { line: "#" },
  ini: { line: ";" },
  conf: { line: "#" },
  properties: { line: "#" },

  // Other
  verilog: { line: "//", block: { start: "/*", end: "*/" } },
  vhdl: { line: "--" },
  assembly: { line: ";" },
  asm: { line: ";" },
  latex: { line: "%" },
  markdown: { line: "<!--", block: { start: "<!--", end: "-->" } },
};

// Detect language from code content
const detectLanguage = (code: string): string => {
  if (!code.trim()) return "javascript";

  const lines = code.trim().split("\n");
  const firstLine = lines[0]?.trim().toLowerCase() || "";

  // Shebang detection
  if (firstLine.startsWith("#!/bin/bash") || firstLine.startsWith("#!/bin/sh")) return "bash";
  if (firstLine.startsWith("#!/bin/zsh")) return "zsh";
  if (firstLine.startsWith("#!/usr/bin/python") || firstLine.startsWith("#!/usr/bin/env python")) return "python";
  if (firstLine.startsWith("#!/usr/bin/ruby") || firstLine.startsWith("#!/usr/bin/env ruby")) return "ruby";
  if (firstLine.startsWith("#!/usr/bin/perl") || firstLine.startsWith("#!/usr/bin/env perl")) return "perl";
  if (firstLine.startsWith("#!/usr/bin/env pwsh") || firstLine.startsWith("#!/usr/bin/pwsh")) return "powershell";

  // TypeScript - check before Haskell (both use ::)
  if (/:\s*(string|number|boolean|any|void|never|unknown)/.test(code) || /interface\s+\w+/.test(code) || (/type\s+\w+\s*=/.test(code) && !code.includes("data"))) return "typescript";

  // Haskell - check after TypeScript
  if (/\b(module|where|data|instance|deriving)\b/.test(code) && /::\s*/.test(code) || /<-/.test(code) && /\b(do|let|in)\b/.test(code)) return "haskell";

  // Elixir
  if (/\bdefmodule\b/.test(code) || /\bdef\s+\w+\s+do\b/.test(code) || code.includes("|>")) return "elixir";

  // Erlang
  if (/^-module\(/.test(code) || /->/.test(code) && code.includes(".") && /\b(fun|receive|case)\b/.test(code)) return "erlang";

  // Julia
  if (/\b(function|end|using|import)\b/.test(code) && /\b(println|push!)\b/.test(code)) return "julia";

  // Nim
  if (/\b(proc|var|let|const|import)\b/.test(code) && code.includes(":")) return "nim";

  // Zig
  if (/\b(pub fn|const|var|comptime)\b/.test(code) || code.includes("@import")) return "zig";

  // Groovy
  if (/\b(def|class)\b/.test(code) && (code.includes("println") || code.includes("@"))) return "groovy";

  // Elm
  if (/\b(module|import|type alias|exposing)\b/.test(code) && code.includes("=")) return "elm";

  // Fortran
  if (/\b(PROGRAM|SUBROUTINE|FUNCTION|END)\b/i.test(code) || /^\s*\d+\s+/.test(code)) return "fortran";

  // Assembly
  if (/\b(mov|push|pop|jmp|call|ret)\b/i.test(code) || /^\s*\w+:/.test(code)) return "assembly";

  // LaTeX
  if (code.includes("\\documentclass") || code.includes("\\begin{") || code.includes("\\usepackage")) return "latex";

  // Markdown
  if (/^#{1,6}\s/.test(code) || /^\*\s/.test(code) || /^-\s/.test(code) || /\[.*\]\(.*\)/.test(code)) return "markdown";

  // Kotlin - distinctive syntax
  if (/\b(fun|val|var)\s+\w+/.test(code) || /:\s*(String|Int|Boolean|Double|Float|Long)/.test(code) || code.includes("companion object")) return "kotlin";

  // Dart - Flutter/Dart specific
  if (/\b(void|Future|async|await)\s+\w+\s*\(/.test(code) && code.includes(";") || code.includes("import 'package:") || code.includes("@override")) return "dart";

  // PowerShell - enhanced detection
  if (/\$(\w+|\{[^}]+\})/.test(code) || /\b(Get-|Set-|New-|Remove-|Test-|Write-|Read-|Start-|Stop-|Invoke-)\w+/i.test(code) || /\[cmdletbinding\(\)\]/i.test(code) || (/\bparam\s*\(/i.test(code) && code.includes("$"))) return "powershell";

  // Bash/Shell - enhanced detection
  if (/\b(echo|grep|awk|sed|cat|ls|cd|mkdir|rm|chmod|chown)\b/.test(code) || /\$\{?\w+\}?/.test(code) || /\|\|/.test(code) || code.includes("[[")||code.includes("$((")) return "bash";

  // Swift
  if (/\b(func|var|let|import UIKit|import Foundation)\b/.test(code) || code.includes("@objc") || /:\s*(String|Int|Bool|Double|Float)/.test(code)) return "swift";

  // Scala
  if (/\b(def|val|var|object|trait|case class)\b/.test(code) || code.includes("=>") && code.includes(":")) return "scala";

  // Rust
  if (/\b(fn|let|mut|impl|trait|struct|enum|pub)\b/.test(code) || code.includes("fn main()") || /->/.test(code)) return "rust";

  // Go
  if (/\b(func|package|import|type|struct|interface|go|defer|chan)\b/.test(code) || code.includes("package main")) return "go";

  // PHP
  if (code.includes("<?php") || /\$\w+\s*=/.test(code) && code.includes(";")) return "php";

  // Python
  if (/\b(def|class|import|from|print|if __name__)\b/.test(code) || /:$/.test(firstLine)) return "python";

  // Java
  if (/\b(public|private|protected)\s+(class|interface|enum)\b/.test(code) || code.includes("public static void main")) return "java";

  // C/C++
  if (/#include\s*[<"]/.test(code) || /\b(int|void|char|float|double)\s+\w+\s*\(/.test(code)) return code.includes("iostream") || code.includes("std::") ? "cpp" : "c";

  // C#
  if (/\b(using|namespace|class|public|private)\b/.test(code) && code.includes(";") || code.includes("Console.")) return "csharp";



  // JavaScript/JSX
  if (/\b(function|const|let|var|=>|async|await)\b/.test(code) || code.includes("require(") || code.includes("import ")) return code.includes("<") && code.includes("/>") ? "jsx" : "javascript";

  // Ruby
  if (/\b(def|end|class|module|require|puts)\b/.test(code) || code.includes("do |")) return "ruby";

  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN)\b/i.test(code)) return "sql";

  // HTML
  if (code.includes("<!DOCTYPE") || code.includes("<html") || /<\w+[^>]*>/.test(code)) return "html";

  // CSS
  if (code.includes("@media") || /^[.#]\w+\s*{/m.test(code) || /\w+\s*:\s*[^;]+;/.test(code)) return "css";

  // YAML
  if (/^\w+:\s/.test(firstLine) || /^\s*-\s+\w+:/.test(code)) return "yaml";

  // TOML
  if (/^\[\w+\]/.test(code) || /^\w+\s*=\s*["']/.test(code)) return "toml";

  // JSON
  if (/^\s*[{\[]/.test(code) && /[}\]]\s*$/.test(code.trim())) return "json";

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
    <div className="bg-gradient-to-r from-primary/90 via-primary/80 to-primary/90 border-t border-white/10 backdrop-blur-xl shadow-lg flex items-center justify-between px-2 md:px-3 py-0.5">
      <div className="flex items-center gap-1.5 md:gap-2">
        <div className="flex items-center gap-1 md:gap-1.5">
          <div
            className={`w-1 md:w-1.5 h-1 md:h-1.5 rounded-full ${getConnectionStatusColor()}`}
          />
          <span className="text-[9px] md:text-[10px] font-medium text-white/90">
            {controls.itemsCount} {controls.itemsCount === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 md:gap-1">
        {/* Export Button */}
        {controls.exportEnabled && controls.canExport && (
          <ExportHistoryButton
            sessionCode={controls.sessionCode}
            canExport={controls.canExport}
            isHost={controls.isHost}
            items={controls.items}
            sessionKey={controls.sessionKey}
            deviceId={controls.deviceId}
          />
        )}

        {/* Pause/Play Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.toggleAutoRefresh}
          className="h-4 md:h-5 w-4 md:w-5 p-0 text-white/90 hover:bg-white/20 rounded-md transition-all"
          title={
            controls.autoRefreshEnabled
              ? "Pause auto-refresh"
              : "Resume auto-refresh"
          }
        >
          {controls.autoRefreshEnabled ? (
            <Pause className="h-2 md:h-2.5 w-2 md:w-2.5" />
          ) : (
            <Play className="h-2 md:h-2.5 w-2 md:w-2.5" />
          )}
        </Button>

        {/* Manual Refresh Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.handleManualRefresh}
          disabled={controls.isRefreshing}
          className={`h-4 md:h-5 w-4 md:w-5 p-0 rounded-md transition-all ${
            controls.isRefreshing
              ? "text-blue-300 animate-spin"
              : "text-white/90 hover:bg-white/20"
          }`}
          title="Manual refresh"
        >
          <RefreshCw className="h-2 md:h-2.5 w-2 md:w-2.5" />
        </Button>

        {/* Timer Interval Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.cycleTimeInterval}
          className="h-4 md:h-5 px-1 md:px-1.5 gap-0.5 md:gap-1 text-white/90 hover:bg-white/20 rounded-md transition-all"
          title="Change refresh interval"
        >
          <Timer className="h-2 md:h-2.5 w-2 md:w-2.5" />
          <span className="text-[9px] md:text-[10px] font-medium">
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
  // Live preview of converted content (only converted output, not original raw)
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewText, setPreviewText] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [braceCheckResult, setBraceCheckResult] = useState<{
    open: boolean;
    success: boolean;
    errors: Array<{ line: number; char: string; type: string; lineContent: string }>;
  }>({ open: false, success: false, errors: [] });
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

  // Enhanced markdown renderer for real-time preview
  const renderMarkdown = (text: string) => {
    if (!text) return "";

    let html = text;

    // Headers (must be at start of line)
    html = html.replace(
      /^### (.+)$/gm,
      '<h3 style="font-size: 1.125rem; font-weight: bold; margin: 0.5rem 0;">$1</h3>'
    );
    html = html.replace(
      /^## (.+)$/gm,
      '<h2 style="font-size: 1.25rem; font-weight: bold; margin: 0.5rem 0;">$1</h2>'
    );
    html = html.replace(
      /^# (.+)$/gm,
      '<h1 style="font-size: 1.5rem; font-weight: bold; margin: 0.5rem 0;">$1</h1>'
    );

    // Bold
    html = html.replace(
      /\*\*(.+?)\*\*/g,
      '<strong style="font-weight: bold;">$1</strong>'
    );

    // Italic
    html = html.replace(
      /(?<!\*)\*([^*]+?)\*(?!\*)/g,
      '<em style="font-style: italic;">$1</em>'
    );

    // Strikethrough
    html = html.replace(
      /~~(.+?)~~/g,
      '<del style="text-decoration: line-through;">$1</del>'
    );

    // Underline
    html = html.replace(
      /<u>(.+?)<\/u>/g,
      '<u style="text-decoration: underline;">$1</u>'
    );

    // Inline code/monospace
    html = html.replace(
      /`(.+?)`/g,
      '<code style="font-family: monospace; background-color: rgba(255,255,255,0.1); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875rem;">$1</code>'
    );

    // Superscript
    html = html.replace(
      /\^(.+?)\^/g,
      '<sup style="vertical-align: super; font-size: 0.75em;">$1</sup>'
    );

    // Subscript
    html = html.replace(
      /~(.+?)~/g,
      '<sub style="vertical-align: sub; font-size: 0.75em;">$1</sub>'
    );

    // Convert newlines to <br>
    html = html.replace(/\n/g, "<br>");

    return html;
  };

  // Detect language when code content changes
  useEffect(() => {
    if (type === "code" && codeContent.trim()) {
      const lang = detectLanguage(codeContent);
      setDetectedLang(lang);
    } else if (type === "code") {
      setDetectedLang("javascript");
    }
  }, [codeContent, type]);

  // Update live preview (converted output only)
  useEffect(() => {
    const updatePreview = async () => {
      try {
        if (type === "text") {
          // Convert markdown-ish to HTML preview (only converted output)
          setPreviewHtml(renderMarkdown(text));
          setPreviewText("");
        } else if (type === "code") {
          // Try to prettify code for preview. Use Prettier where available.
          const source = codeContent || "";
          if (!source.trim()) {
            setPreviewHtml("");
            setPreviewText("");
            return;
          }

          const mapLangToParser: Record<string, string> = {
            javascript: "babel",
            typescript: "typescript",
            jsx: "babel",
            tsx: "typescript",
            html: "html",
            css: "css",
            json: "json",
            // fallback
          };

          const parser =
            mapLangToParser[detectedLang] ||
            (detectedLang === "python" ? "babel" : "babel");

          try {
            const formatted = await (prettier.format as any)(source, {
              parser: parser as any,
              plugins: [
                prettierBabel as any,
                prettierTypescript as any,
                prettierHtml as any,
                prettierCss as any,
                prettierEstree as any,
              ],
            });
            // render as escaped code block
            setPreviewHtml("");
            setPreviewText(formatted as string);
          } catch (e) {
            // Fallback: show raw code escaped
            setPreviewHtml("");
            setPreviewText(source);
          }
        } else {
          setPreviewHtml("");
          setPreviewText("");
        }
      } catch (err) {
        setPreviewHtml("");
        setPreviewText("");
      }
    };

    updatePreview();
  }, [textContent, codeContent, type, detectedLang]);

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
            setIsFrozen(payload.new.is_frozen === true);
            setCanView(payload.new.can_view !== false);
          }
        }
      )
      // Listen for realtime broadcast events for instant permission changes
      .on("broadcast", { event: "permission_changed" }, (payload) => {
        if (payload.payload.device_id === deviceId) {
          setIsFrozen(payload.payload.is_frozen === true);
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
          useTabs: false,
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
      if (!selectedText) {
        // If no selection, comment current line
        const lines = text.split("\n");
        const currentLineIndex = text.substring(0, start).split("\n").length - 1;
        const currentLine = lines[currentLineIndex];
        
        const commentSyntax = langComments.line;
        const commentEscaped = commentSyntax.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const commentPattern = new RegExp(`^(\\s*)${commentEscaped}\\s?`);
        
        if (commentPattern.test(currentLine)) {
          lines[currentLineIndex] = currentLine.replace(commentPattern, "$1");
        } else {
          const leadingSpace = currentLine.match(/^\s*/)?.[0] || "";
          const content = currentLine.substring(leadingSpace.length);
          lines[currentLineIndex] = leadingSpace + commentSyntax + " " + content;
        }
        
        newText = lines.join("\n");
        newCursorPos = start;
      } else {
        // Comment selected lines
        const lines = selectedText.split("\n");
        const commentSyntax = langComments.line;
        const commentEscaped = commentSyntax.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      }
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
      // Advanced brace checker: handles strings, comments, and all bracket types
      const codeToCheck = text;
      const lines = text.split("\n");
      const stack: Array<{ char: string; pos: number; line: number }> = [];
      const errors: Array<{ line: number; char: string; type: string; lineContent: string }> = [];
      const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
      const closePairs: Record<string, string> = { "}": "{", "]": "[", ")": "(" };

      let line = 1;
      let inString = false;
      let stringChar = "";
      let inLineComment = false;
      let inBlockComment = false;

      for (let i = 0; i < codeToCheck.length; i++) {
        const char = codeToCheck[i];
        const nextChar = codeToCheck[i + 1];
        const prevChar = codeToCheck[i - 1];

        // Handle newlines
        if (char === "\n") {
          line++;
          inLineComment = false;
          continue;
        }

        // Skip if in line comment
        if (inLineComment) continue;

        // Check for block comment start/end
        if (!inString && char === "/" && nextChar === "*") {
          inBlockComment = true;
          i++;
          continue;
        }
        if (inBlockComment && char === "*" && nextChar === "/") {
          inBlockComment = false;
          i++;
          continue;
        }
        if (inBlockComment) continue;

        // Check for line comment
        if (!inString && char === "/" && nextChar === "/") {
          inLineComment = true;
          continue;
        }

        // Handle strings (ignore escaped quotes)
        if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = "";
          }
          continue;
        }

        // Skip if in string
        if (inString) continue;

        // Check brackets
        if (pairs[char]) {
          stack.push({ char, pos: i, line });
        } else if (closePairs[char]) {
          if (stack.length === 0) {
            errors.push({ line, char, type: "unexpected_close", lineContent: lines[line - 1] || "" });
          } else {
            const last = stack.pop()!;
            if (pairs[last.char] !== char) {
              errors.push({ line, char, type: "mismatch", lineContent: lines[line - 1] || "" });
              stack.push(last); // Put it back for better error reporting
            }
          }
        }
      }

      // Unclosed braces
      while (stack.length > 0) {
        const unclosed = stack.pop()!;
        errors.push({ line: unclosed.line, char: unclosed.char, type: "unclosed", lineContent: lines[unclosed.line - 1] || "" });
      }

      // Show result in bottom sheet
      setBraceCheckResult({
        open: true,
        success: errors.length === 0,
        errors: errors,
      });
      
      // Don't auto-fix, just report
      return;
    } else if (format === "duplicate") {
      // Duplicate current line or selection
      if (selectedText) {
        newText = text.substring(0, end) + "\n" + selectedText + text.substring(end);
        newCursorPos = end + selectedText.length + 1;
      } else {
        const lines = text.split("\n");
        const currentLineIndex = text.substring(0, start).split("\n").length - 1;
        const currentLine = lines[currentLineIndex];
        lines.splice(currentLineIndex + 1, 0, currentLine);
        newText = lines.join("\n");
        newCursorPos = start + currentLine.length + 1;
      }
    } else if (format === "removeComments") {
      // Intelligent multi-language comment removal
      const commentSyntax = langComments.line;
      const blockComment = langComments.block;
      let cleaned = text;
      
      // Remove block comments if language supports them
      if (blockComment) {
        const blockStart = blockComment.start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const blockEnd = blockComment.end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const blockPattern = new RegExp(`${blockStart}[\\s\\S]*?${blockEnd}`, "g");
        cleaned = cleaned.replace(blockPattern, "");
      }
      
      // Remove line comments
      const lines = cleaned.split("\n");
      const commentEscaped = commentSyntax.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      
      const cleanedLines = lines.map(line => {
        let inString = false;
        let stringChar = "";
        let result = "";
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const remaining = line.substring(i);
          
          // Track string state
          if ((char === '"' || char === "'" || char === "`") && line[i - 1] !== "\\") {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
              stringChar = "";
            }
          }
          
          // Check for line comment outside strings
          if (!inString && remaining.startsWith(commentSyntax)) {
            break; // Rest of line is comment
          }
          
          result += char;
        }
        
        return result.trimEnd();
      });
      
      // Remove empty lines that were only comments
      newText = cleanedLines.filter(line => line.trim() !== "").join("\n");
      newCursorPos = 0;
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
      className="fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out"
      ref={containerRef}
    >
      {/* Backdrop when focused */}
      {isFocused && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10 animate-in fade-in duration-300"
          onClick={(e) => {
            e.stopPropagation();
            setIsFocused(false);
            textareaRef.current?.blur();
          }}
        />
      )}

      {/* History Control Bar - Above input panel  */}
      <HistoryControlBar />

      <div
        className="bg-slate-900/90 backdrop-blur-xl border-t border-slate-700/50 shadow-2xl transition-all duration-300 ease-out"
      >
        {/* Frozen Banner */}
        {isFrozen && (
          <div className="bg-orange-500/20 border-b border-orange-500/30 px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-medium text-orange-300">🔒 Input Frozen - You can view but cannot write</span>
          </div>
        )}
        <form onSubmit={submit} className="h-full flex flex-col relative">
          {/* Single Row: Fixed Tabs (Left) + Scrollable Formatting (Right) */}
          <div className="shrink-0 px-2 py-0.5 md:px-3 md:py-1 border-b border-white/5 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/80 backdrop-blur-xl flex items-center gap-1.5 md:gap-2">
            {/* Left: Fixed Tab Buttons */}
            <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                disabled={!canView || (type !== "text" && codeContent.trim() !== "")}
                onClick={() => setType("text")}
                size="sm"
                className={`h-6 md:h-6 px-2.5 md:px-3 text-[10px] md:text-[11px] font-medium rounded-none border-b-2 transition-all duration-300 ease-out hover:scale-105 ${
                  type === "text"
                    ? "border-primary text-foreground"
                    : "border-transparent hover:border-white/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Type className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1 md:mr-1.5" />
                Text
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!canView || (type !== "code" && textContent.trim() !== "")}
                onClick={() => setType("code")}
                size="sm"
                className={`h-6 md:h-6 px-2.5 md:px-3 text-[10px] md:text-[11px] font-medium rounded-none border-b-2 transition-all duration-300 ease-out hover:scale-105 ${
                  type === "code"
                    ? "border-primary text-foreground"
                    : "border-transparent hover:border-white/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1 md:mr-1.5" />
                Code
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!canView}
                onClick={() => setType("file")}
                size="sm"
                className={`h-6 md:h-6 px-2.5 md:px-3 text-[10px] md:text-[11px] font-medium rounded-none border-b-2 transition-all duration-300 ease-out hover:scale-105 ${
                  type === "file"
                    ? "border-primary text-foreground"
                    : "border-transparent hover:border-white/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1 md:mr-1.5" />
                File
              </Button>
            </div>

            {/* Separator */}
            {type !== "file" && isFocused && (
              <div className="w-px h-3 md:h-4 bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />
            )}

            {/* Right: Scrollable Formatting Toolbar */}
            {type !== "file" && isFocused && (
              <div className="flex-1 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1 md:gap-1.5 min-w-max">
                  {/* Preview Toggle Button - Only show when there's content */}
                  {text.trim() && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className={`h-6 md:h-6 w-6 md:w-6 p-0 rounded-md shrink-0 transition-all duration-200 ease-out hover:scale-110 ${
                          showPreview
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-white/5 text-muted-foreground"
                        }`}
                        title="Toggle Preview"
                      >
                        <Eye className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <div className="w-px h-3 md:h-4 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-1 shrink-0" />
                    </>
                  )}
                  {type === "text" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("bold")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Bold (Ctrl+B)"
                      >
                        <Bold className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("italic")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Italic (Ctrl+I)"
                      >
                        <Italic className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("underline")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Underline"
                      >
                        <Underline className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("strikethrough")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Strikethrough"
                      >
                        <Strikethrough className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("monospace")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Monospace"
                      >
                        <MonitorDot className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <div className="w-px h-3 md:h-4 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5 shrink-0" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("h1")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Heading 1"
                      >
                        <Heading1 className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("h2")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Heading 2"
                      >
                        <Heading2 className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("h3")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Heading 3"
                      >
                        <Heading3 className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <div className="w-px h-3 md:h-4 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5 shrink-0" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("uppercase")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="UPPERCASE"
                      >
                        <span className="text-[8px] md:text-[9px] font-bold">AA</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleTextFormat("lowercase")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="lowercase"
                      >
                        <span className="text-[8px] md:text-[9px] font-bold">aa</span>
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
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Comment (Ctrl+/)"
                      >
                        <Hash className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("indent")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Indent (Tab)"
                      >
                        <Indent className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("outdent")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Outdent (Shift+Tab)"
                      >
                        <Outdent className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <div className="w-px h-3 md:h-4 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5 shrink-0" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("braces")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Check Braces"
                      >
                        <Braces className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("prettify")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Prettify (Format with Prettier)"
                      >
                        <Sparkles className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("minify")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Minify (Remove Whitespace)"
                      >
                        <Minimize2 className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("wrap")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="Wrap Long Lines"
                      >
                        <WrapText className="h-2.5 md:h-3 w-2.5 md:w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("uppercase")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="UPPERCASE"
                      >
                        <span className="text-[8px] md:text-[9px] font-bold">AA</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("lowercase")}
                        className="h-5 md:h-6 w-5 md:w-6 p-0 rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-110 text-muted-foreground hover:text-foreground"
                        title="lowercase"
                      >
                        <span className="text-[8px] md:text-[9px] font-bold">aa</span>
                      </Button>
                      <div className="w-px h-3 md:h-4 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5 shrink-0" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("duplicate")}
                        className="h-5 md:h-6 px-1.5 md:px-2 text-[10px] md:text-[11px] rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-105 text-muted-foreground hover:text-foreground"
                        title="Duplicate Line"
                      >
                        <Copy className="h-2.5 md:h-3 w-2.5 md:w-3 mr-0.5 md:mr-1" />
                        Dup
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canView}
                        onClick={() => handleCodeFormat("removeComments")}
                        className="h-5 md:h-6 px-1.5 md:px-2 text-[10px] md:text-[11px] rounded-md shrink-0 hover:bg-white/5 transition-all duration-200 ease-out hover:scale-105 text-muted-foreground hover:text-foreground"
                        title="Remove All Comments"
                      >
                        <Eraser className="h-2.5 md:h-3 w-2.5 md:w-3 mr-0.5 md:mr-1" />
                        Clean
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
                className="h-4 md:h-5 px-2 md:px-2.5 text-[9px] md:text-[10px] font-mono shrink-0 bg-white/5 border-white/10 backdrop-blur-sm rounded-md"
              >
                <Languages className="h-2 md:h-2.5 w-2 md:w-2.5 mr-1 md:mr-1.5" />
                {detectedLang}
              </Badge>
            )}
          </div>

          {/* Main Input Area - Flex grows to take available space */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {type === "file" ? (
              <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
                <label
                  htmlFor="file-upload"
                  className={`
                    w-full max-w-md flex flex-col items-center justify-center gap-4
                    min-h-[180px] sm:min-h-[160px] p-6 sm:p-8 rounded-xl border-2 border-dashed
                    cursor-pointer transition-all duration-300 ease-out
                    ${
                      fileError
                        ? "border-destructive bg-destructive/10 hover:bg-destructive/15"
                        : file
                          ? "border-primary bg-primary/10 hover:bg-primary/15"
                          : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
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
                    <>
                      <div className="relative">
                        <div className="w-16 h-16 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center">
                          <FileText className="h-8 w-8 sm:h-7 sm:w-7 text-primary" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                      <div className="text-center w-full space-y-1.5">
                        <div className="text-sm sm:text-xs font-semibold truncate max-w-full px-2">
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
                        className="h-9 px-5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
                      >
                        Change File
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="w-16 h-16 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/20">
                          <Upload className="h-8 w-8 sm:h-7 sm:w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
                        </div>
                      </div>
                      <div className="text-center space-y-1.5">
                        <div className="text-sm sm:text-xs font-semibold">
                          Drop file or tap to browse
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Max 5MB • All file types supported
                        </div>
                      </div>
                    </>
                  )}
                </label>
                {fileError && (
                  <div className="absolute bottom-20 left-4 right-4 text-sm sm:text-xs text-destructive bg-destructive/10 p-4 sm:p-3 rounded-lg flex items-start gap-2 border border-destructive/20">
                    <Shield className="h-5 w-5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 relative flex flex-col">
                {!showPreview ? (
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
                      const newValue = e.target.value;
                      if (type === "text" && codeContent) {
                        setCodeContent("");
                      } else if (type === "code" && textContent) {
                        setTextContent("");
                      }
                      setText(newValue);
                    }}
                    disabled={!canView || isFrozen}
                    onKeyDown={(e) => {
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
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (isFrozen || !canView) return;
                        submit();
                      }
                    }}
                    className={`
                        w-full resize-none border-0
                        focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0
                        ${type === "code" ? "font-mono text-xs sm:text-sm leading-relaxed" : "text-xs sm:text-sm leading-relaxed"}
                        ${isFocused ? "h-[40vh] sm:h-[50vh] md:h-[60vh]" : "h-32 sm:h-28"}
                        p-3 sm:p-4 pb-12 sm:pb-10 bg-transparent
                        scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent
                        transition-all duration-300 ease-out
                      `}
                  />
                ) : (
                  <div className={`
                    w-full overflow-auto
                    ${type === "code" ? "font-mono text-sm leading-relaxed" : "text-sm leading-relaxed"}
                    ${isFocused ? "h-[40vh] sm:h-[50vh] md:h-[60vh]" : "h-32 sm:h-28"}
                    p-3 sm:p-4 pb-12 sm:pb-10 bg-transparent
                    scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent
                    transition-all duration-300 ease-out
                  `}>
                    {type === "text" ? (
                      <div
                        className="prose prose-sm prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap">
                        <code>{previewText}</code>
                      </pre>
                    )}
                  </div>
                )}

                {/* Send button inside textarea - bottom right */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                  {text.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setText("")}
                      className="h-8 px-3 rounded-full text-xs transition-all duration-200 ease-out hover:scale-105 active:scale-95"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={busy || !canView || !sessionKey || !text.trim()}
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full shadow-lg transition-all duration-200 ease-out hover:scale-110 active:scale-95"
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
          {type === "file" && file && !fileError && (
            <div className="shrink-0 px-3 py-2 border-t border-primary/10 bg-slate-900/95 backdrop-blur-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">{file.name}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setFileError(null);
                  }}
                  className="h-8 px-3 text-xs hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  disabled={busy || !canView || !sessionKey}
                  size="sm"
                  className="h-8 px-4 text-xs font-semibold shadow-lg hover:scale-105 transition-all"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Sending
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}



          {/* Hidden overlay only */}
          {!canView && <MaskedOverlay variant="hidden" />}
          {/* Frozen overlay - only covers form */}
          {isFrozen && <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 cursor-not-allowed pointer-events-auto" />}
        </form>
      </div>

      {isLeaving && <LeavingCountdown reason={leaveReason} />}

      <ErrorDialog
        open={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, title: "", message: "" })}
        title={errorDialog.title}
        message={errorDialog.message}
      />

      {/* Activity Log Bottom Sheet */}
      {showActivityLog && activityLog.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowActivityLog(false)}
          />
          <div className="relative w-full max-w-md bg-background border-t border-border rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Upload Activity</h3>
                  <p className="text-sm text-muted-foreground">
                    Processing your {type === "file" ? "file" : type} upload
                  </p>
                </div>
              </div>
              
              <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                {activityLog.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-[10px] font-mono">
                    <span className="text-primary shrink-0">›</span>
                    <span className="text-muted-foreground flex-1">{log}</span>
                  </div>
                ))}
              </div>
              
              {!busy && (
                <Button
                  onClick={() => setShowActivityLog(false)}
                  className="w-full mt-4"
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Brace Check Result Bottom Sheet */}
      {braceCheckResult.open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setBraceCheckResult({ open: false, success: false, errors: [] })}
          />
          <div className="relative w-full max-w-md bg-background border-t border-border rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {braceCheckResult.success ? (
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">
                    {braceCheckResult.success ? "All Braces Matched!" : "Brace Errors Found"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {braceCheckResult.success 
                      ? "Your code has no bracket mismatches" 
                      : `${braceCheckResult.errors.length} error${braceCheckResult.errors.length > 1 ? 's' : ''} detected`}
                  </p>
                </div>
              </div>
              
              {!braceCheckResult.success && braceCheckResult.errors.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {braceCheckResult.errors.map((error, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-destructive/10 rounded border border-destructive/20">
                      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-destructive">{error.line}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {error.type === "unclosed" && `Unclosed '${error.char}'`}
                          {error.type === "unexpected_close" && `Unexpected '${error.char}'`}
                          {error.type === "mismatch" && `Mismatched '${error.char}'`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Line {error.line}</p>
                        {error.lineContent && (
                          <code className="block mt-2 text-xs bg-background/50 p-2 rounded border border-destructive/20 font-mono truncate">
                            {error.lineContent.trim()}
                          </code>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <Button
                onClick={() => setBraceCheckResult({ open: false, success: false, errors: [] })}
                className="w-full mt-4"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
