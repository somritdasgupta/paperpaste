"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState } from "react";
import ExportDialog from "./export-dialog";

interface ExportHistoryButtonProps {
  sessionCode: string;
  canExport: boolean;
  isHost: boolean;
  items: any[];
  sessionKey: CryptoKey | null;
  deviceId: string;
}

export default function ExportHistoryButton({
  sessionCode,
  canExport,
  isHost,
  items,
  sessionKey,
  deviceId,
}: ExportHistoryButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  if (!canExport || items.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowDialog(true)}
        className="h-5 px-1.5 gap-1 text-white hover:bg-white/20 transition-all duration-200"
      >
        <Download className="h-2.5 w-2.5" />
        <span className="hidden sm:inline text-[10px]">Export</span>
      </Button>

      <ExportDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        items={items}
        sessionKey={sessionKey}
        deviceId={deviceId}
        sessionCode={sessionCode}
      />
    </>
  );
}
