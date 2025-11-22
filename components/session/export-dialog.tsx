"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, FileJson, Loader2, Check, Lock, Unlock, AlertTriangle } from "lucide-react";
import { decryptData } from "@/lib/encryption";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  items: any[];
  sessionKey: CryptoKey | null;
  deviceId: string;
  sessionCode: string;
}

export default function ExportDialog({ open, onClose, items, sessionKey, deviceId, sessionCode }: ExportDialogProps) {
  const [format, setFormat] = useState<"txt" | "json">("txt");
  const [processing, setProcessing] = useState(false);
  const [verificationLog, setVerificationLog] = useState<string[]>([]);
  const [showVerification, setShowVerification] = useState(false);

  const addLog = (message: string) => {
    setVerificationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleExport = async () => {
    if (!sessionKey) return;
    
    setProcessing(true);
    setShowVerification(true);
    setVerificationLog([]);

    try {
      addLog("[CRYPTO] Starting export with E2E encryption verification...");
      addLog(`[INFO] Total items to process: ${items.length}`);
      
      const exportData: any[] = [];
      let myItemsCount = 0;
      let otherItemsCount = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isMyItem = item.device_id === deviceId;
        
        addLog(`\n[PROCESS] Item ${i + 1}/${items.length} (${item.kind})...`);

        if (isMyItem) {
          // Decrypt my items
          addLog(`[DECRYPT] Own item - Device match confirmed`);
          
          let content = null;
          if (item.content_encrypted) {
            addLog(`  [AES-256-GCM] Decrypting content...`);
            content = await decryptData(item.content_encrypted, sessionKey);
            addLog(`  [SUCCESS] Content decrypted`);
          }

          let fileName = null, fileMimeType = null, fileSize = null;
          if (item.kind === "file") {
            addLog(`  [METADATA] Decrypting file metadata...`);
            if (item.file_name_encrypted) fileName = await decryptData(item.file_name_encrypted, sessionKey);
            if (item.file_mime_type_encrypted) fileMimeType = await decryptData(item.file_mime_type_encrypted, sessionKey);
            if (item.file_size_encrypted) fileSize = await decryptData(item.file_size_encrypted, sessionKey);
            addLog(`  [SUCCESS] File metadata decrypted`);
          }

          exportData.push({
            id: item.id,
            type: item.kind,
            content: content || "[No content]",
            fileName: fileName,
            fileMimeType: fileMimeType,
            fileSize: fileSize,
            timestamp: item.created_at,
            encrypted: false,
            deviceId: item.device_id
          });
          myItemsCount++;
          addLog(`[EXPORTED] Item ${i + 1} (DECRYPTED)`);
        } else {
          // Keep other items encrypted
          addLog(`[ENCRYPTED] Different device - Keeping encrypted`);
          exportData.push({
            id: item.id,
            type: item.kind,
            content_encrypted: item.content_encrypted,
            file_name_encrypted: item.file_name_encrypted,
            file_mime_type_encrypted: item.file_mime_type_encrypted,
            file_size_encrypted: item.file_size_encrypted,
            timestamp: item.created_at,
            encrypted: true,
            deviceId: item.device_id,
            note: "Encrypted - belongs to another device"
          });
          otherItemsCount++;
          addLog(`[EXPORTED] Item ${i + 1} (ENCRYPTED)`);
        }
      }

      addLog(`\n[SUMMARY] Export Summary:`);
      addLog(`  [DECRYPTED] Your items: ${myItemsCount}`);
      addLog(`  [ENCRYPTED] Other items: ${otherItemsCount}`);
      addLog(`  [TOTAL] Total items: ${exportData.length}`);

      // Generate export file
      addLog(`\n[GENERATE] Creating ${format.toUpperCase()} file...`);
      
      let blob: Blob;
      let filename: string;

      if (format === "json") {
        const jsonData = {
          session: sessionCode,
          exportedAt: new Date().toISOString(),
          totalItems: exportData.length,
          decryptedItems: myItemsCount,
          encryptedItems: otherItemsCount,
          items: exportData
        };
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
        filename = `paperpaste-${sessionCode}-${Date.now()}.json`;
      } else {
        let txtContent = `PaperPaste Export\n`;
        txtContent += `Session: ${sessionCode}\n`;
        txtContent += `Exported: ${new Date().toLocaleString()}\n`;
        txtContent += `Total Items: ${exportData.length}\n`;
        txtContent += `Your Items (Decrypted): ${myItemsCount}\n`;
        txtContent += `Other Items (Encrypted): ${otherItemsCount}\n`;
        txtContent += `\n${"=".repeat(80)}\n\n`;

        exportData.forEach((item, idx) => {
          txtContent += `Item ${idx + 1}\n`;
          txtContent += `Type: ${item.type}\n`;
          txtContent += `Timestamp: ${new Date(item.timestamp).toLocaleString()}\n`;
          txtContent += `Status: ${item.encrypted ? "[ENCRYPTED] Other Device" : "[DECRYPTED] Your Device"}\n`;
          
          if (!item.encrypted) {
            if (item.type === "file") {
              txtContent += `File Name: ${item.fileName || "N/A"}\n`;
              txtContent += `File Type: ${item.fileMimeType || "N/A"}\n`;
              txtContent += `File Size: ${item.fileSize || "N/A"} bytes\n`;
            } else {
              txtContent += `Content:\n${item.content}\n`;
            }
          } else {
            txtContent += `Note: ${item.note}\n`;
          }
          
          txtContent += `\n${"-".repeat(80)}\n\n`;
        });

        blob = new Blob([txtContent], { type: "text/plain" });
        filename = `paperpaste-${sessionCode}-${Date.now()}.txt`;
      }

      addLog(`[SUCCESS] File generated successfully`);
      addLog(`[DOWNLOAD] Downloading: ${filename}`);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      addLog(`\n[COMPLETE] Export completed successfully!`);
      
      setTimeout(() => {
        onClose();
        setShowVerification(false);
        setVerificationLog([]);
      }, 2000);

    } catch (error: any) {
      addLog(`\n[ERROR] ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Session History</DialogTitle>
        </DialogHeader>

        {!showVerification ? (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Export Format</label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={format === "txt" ? "default" : "outline"}
                  onClick={() => setFormat("txt")}
                  className="h-20 flex-col gap-2"
                >
                  <FileText className="h-6 w-6" />
                  <span>Plain Text</span>
                </Button>
                <Button
                  variant={format === "json" ? "default" : "outline"}
                  onClick={() => setFormat("json")}
                  className="h-20 flex-col gap-2"
                >
                  <FileJson className="h-6 w-6" />
                  <span>JSON</span>
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4" />
                <span>Security & Privacy</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Your items will be decrypted and readable</li>
                <li>Other participants' items remain encrypted</li>
                <li>Real-time verification process shown</li>
                <li>Export includes {items.length} total items</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-3">
            <div className="flex items-center gap-2">
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Check className="h-5 w-5 text-green-500" />
              )}
              <span className="font-medium">
                {processing ? "Processing Export..." : "Export Complete!"}
              </span>
            </div>

            <div className="bg-black/90 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
              {verificationLog.map((log, i) => (
                <div key={i} className="text-green-400">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!showVerification ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={processing}>
                <Download className="h-4 w-4 mr-2" />
                Export {format.toUpperCase()}
              </Button>
            </>
          ) : (
            <Button onClick={onClose} disabled={processing}>
              {processing ? "Processing..." : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
