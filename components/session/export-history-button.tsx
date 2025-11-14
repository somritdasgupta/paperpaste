"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileJson, FileCode } from "lucide-react";
import { useState } from "react";
import { ErrorDialog } from "@/components/ui/error-dialog";

interface ExportHistoryButtonProps {
  sessionCode: string;
  canExport: boolean;
  isHost: boolean;
}

export default function ExportHistoryButton({
  sessionCode,
  canExport,
  isHost,
}: ExportHistoryButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  const handleExport = async (format: "pdf" | "json" | "txt") => {
    setExporting(true);
    try {
      const response = await fetch(`/api/export-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode, format }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Export failed" }));
        throw new Error(
          errorData.error || `Export failed with status ${response.status}`
        );
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paperpaste-${sessionCode}-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error("Export error:", error);
      setErrorDialog({
        open: true,
        title: "Export Failed",
        message: error.message || "Failed to export history. Please try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  if (!canExport) {
    return null; // Don't show button if export is disabled
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={exporting}
            className="h-8 gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export Format</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleExport("txt")}
            disabled={exporting}
            className="cursor-pointer"
          >
            <FileText className="h-4 w-4 mr-2" />
            Plain Text (.txt)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="cursor-pointer"
          >
            <FileJson className="h-4 w-4 mr-2" />
            JSON (.json)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ErrorDialog
        open={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, title: "", message: "" })}
        title={errorDialog.title}
        message={errorDialog.message}
      />
    </>
  );
}
