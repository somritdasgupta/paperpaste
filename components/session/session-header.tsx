"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  QrCode,
  TvMinimalIcon,
  Check,
  ChevronDown,
  MailIcon,
  MailCheckIcon,
} from "lucide-react";
import DeviceCountBadge from "@/components/session/device-count-badge";
import { useHistoryControls } from "@/components/session/history-controls-context";

export default function SessionHeader({ code }: { code: string }) {
  const { openBottomSheet } = useHistoryControls();
  const [copied, setCopied] = useState(false);
  const [codeFlashing, setCodeFlashing] = useState(false);
  const codeFlashTimer = useRef<number | null>(null);
  const [invite, setInvite] = useState(`/session/${code}`);
  const [showMobileCode, setShowMobileCode] = useState(false);

  useEffect(() => {
    setInvite(`${window.location.origin}/session/${code}`);
  }, [code]);

  useEffect(() => {
    if (showMobileCode) {
      const timer = setTimeout(() => {
        setShowMobileCode(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showMobileCode]);

  const copySessionCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      if (codeFlashTimer.current) {
        window.clearTimeout(codeFlashTimer.current);
      }
      setCodeFlashing(true);
      codeFlashTimer.current = window.setTimeout(() => {
        setCodeFlashing(false);
        codeFlashTimer.current = null;
      }, 350);
    } catch (e) {
      // ignore
    }
  };

  const handleMobileCodeToggle = async () => {
    if (!showMobileCode) {
      setShowMobileCode(true);
      try {
        await navigator.clipboard.writeText(code);
        setCodeFlashing(true);
        if (codeFlashTimer.current) {
          window.clearTimeout(codeFlashTimer.current);
        }
        codeFlashTimer.current = window.setTimeout(() => {
          setCodeFlashing(false);
          codeFlashTimer.current = null;
        }, 800);
      } catch (e) {
        // ignore
      }
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight transition-all duration-300">
              <span className={`sm:hidden ${showMobileCode ? "hidden" : ""}`}>
                PaperPaste
              </span>
              {showMobileCode && (
                <span
                  className={`sm:hidden text-primary font-mono animate-in fade-in zoom-in-95 duration-200 ${
                    codeFlashing ? "text-green-600" : ""
                  }`}
                >
                  {code}
                </span>
              )}
              <span className="hidden sm:inline">PaperPaste</span>
            </h1>

            <div
              className={`hidden sm:inline-flex items-center bg-primary/10 border border-primary/20 rounded px-1 py-0.2 cursor-pointer select-none transition-all duration-200 ${
                codeFlashing ? "ring-2 ring-green-400 scale-105" : ""
              }`}
              onClick={copySessionCode}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") copySessionCode();
              }}
              aria-label={`Copy session code ${code}`}
            >
              <span className="text-xs font-bold session-code text-primary tracking-tighter">
                {code}
              </span>
            </div>

            <button
              onClick={handleMobileCodeToggle}
              className={`sm:hidden flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-all duration-200 ${
                showMobileCode ? "bg-green-500/20" : ""
              }`}
              aria-label="Show and copy session code"
            >
              {codeFlashing ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Invite Button */}
          <Button
            variant={copied ? "default" : "outline"}
            size="sm"
            onClick={copy}
            className={`gap-1.5 text-xs h-8 px-3 transition-all ${
              copied ? "bg-green-600 hover:bg-green-700" : ""
            }`}
          >
            {copied ? (
              <MailCheckIcon className="h-3.5 w-3.5" />
            ) : (
              <MailIcon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Invite"}</span>
          </Button>

          {/* QR Code */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openBottomSheet("qr")}
            className="gap-1.5 h-8 px-3"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">QR</span>
          </Button>

          {/* Devices */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openBottomSheet("devices")}
            className="gap-1.5 h-8 px-3 relative"
          >
            <TvMinimalIcon className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Devices</span>
            <DeviceCountBadge code={code} />
          </Button>
        </div>
      </header>
    </div>
  );
}
