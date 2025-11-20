"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Link as LinkIcon, QrCode as QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRCodePanelProps {
  code: string;
}

export default function QRCodePanel({ code }: QRCodePanelProps) {
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInvite(`${window.location.origin}/session/${code}`);
    }
  }, [code]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy invite link", e);
    }
  };

  if (!invite) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4">
      {/* QR Code */}
      <div className="relative">
        <div className="bg-white p-6 rounded-lg border-2 border-zinc-200 shadow-sm">
          {!qrLoaded && (
            <div className="w-[200px] h-[200px] flex items-center justify-center bg-zinc-100 rounded animate-pulse">
              <QrCodeIcon className="h-12 w-12 text-zinc-400" />
            </div>
          )}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
              invite
            )}`}
            alt="Session QR Code"
            width={200}
            height={200}
            className={`rounded ${qrLoaded ? 'block' : 'hidden'}`}
            onLoad={() => setQrLoaded(true)}
            onError={() => setQrLoaded(false)}
          />
        </div>
        <div className="absolute -top-2 -right-2 bg-green-500 text-white p-2 rounded-full shadow-lg">
          <QrCodeIcon className="h-4 w-4" />
        </div>
      </div>

      {/* Invite Link */}
      <div className="w-full max-w-md space-y-3">
        <div className="text-center">
          <h3 className="font-semibold text-base">Scan to Join Session</h3>
          <p className="text-xs text-zinc-500">Or share the link below</p>
        </div>

        <Button 
          onClick={copyInvite} 
          className="w-full" 
          variant={copied ? "default" : "outline"}
          size="lg"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Invite Link
            </>
          )}
        </Button>
      </div>

      {/* Session Code */}
      <div className="text-center">
        <p className="text-[10px] text-zinc-600 mb-1">Session Code</p>
        <p className="text-2xl font-bold tracking-wider text-zinc-200 font-mono">
          {code}
        </p>
      </div>
    </div>
  );
}
