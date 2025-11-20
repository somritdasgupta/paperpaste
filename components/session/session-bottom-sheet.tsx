"use client";

import { useHistoryControls } from "./history-controls-context";
import { UnifiedBottomSheet } from "./unified-bottom-sheet";
import DevicesPanel from "./devices-panel";
import { VerificationContent } from "./verification-content";
import QRCodePanel from "./qr-code-panel";
import { Button } from "@/components/ui/button";
import { Trash2, LogOut, AlertTriangle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";

export default function SessionBottomSheet() {
  const { bottomSheet, closeBottomSheet, sessionCode } = useHistoryControls();
  const { isOpen, view, data } = bottomSheet;

  // Helper to get title and description based on view
  const getContent = () => {
    switch (view) {
      case "devices":
        return {
          title: "Connected Devices",
          description: "Manage devices connected to this session.",
          content: <DevicesPanel code={sessionCode} />,
        };
      case "qr":
        return {
          title: "Share Session",
          description: "Scan this QR code to join the session on another device.",
          content: <QRCodePanel code={sessionCode} />,
        };
      case "verification":
        return {
          title: "Session Verification",
          description: "Verify the integrity of your end-to-end encryption.",
          content: (
            <VerificationContent
              sessionKey={data?.sessionKey}
              sessionCode={sessionCode}
              isItemVerification={data?.isItemVerification}
              itemType={data?.itemType}
            />
          ),
        };
      case "delete-item":
        return {
          title: "Delete Item",
          description: "Are you sure you want to delete this item? This action cannot be undone.",
          content: <DeleteItemConfirm itemId={data?.itemId} sessionCode={sessionCode} onClose={closeBottomSheet} />,
        };
      case "leave-session":
        return {
          title: "Leave Session",
          description: "Are you sure you want to leave this session?",
          content: <LeaveSessionConfirm data={data} sessionCode={sessionCode} onClose={closeBottomSheet} />,
        };
      case "kill-session":
        return {
          title: "Purge Session",
          description: "This will permanently delete all data and disconnect all devices.",
          content: <KillSessionConfirm sessionCode={sessionCode} onClose={closeBottomSheet} />,
        };
      default:
        return { title: "", description: "", content: null };
    }
  };

  const { title, description, content } = getContent();

  return (
    <UnifiedBottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => !open && closeBottomSheet()}
      title={title}
      description={description}
    >
      {content}
    </UnifiedBottomSheet>
  );
}

// Sub-components for confirmations

function DeleteItemConfirm({ itemId, sessionCode, onClose }: { itemId: string; sessionCode: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserWithCode(sessionCode);
    if (supabase) {
      await supabase.from("items").delete().eq("id", itemId);
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center gap-4 p-4 bg-destructive/10 text-destructive rounded-lg">
        <Trash2 className="h-6 w-6" />
        <p className="text-sm font-medium">This item will be permanently removed from all devices.</p>
      </div>
      <div className="flex justify-center pt-2">
        <Button 
          variant="destructive" 
          onClick={handleDelete} 
          disabled={loading}
        >
          {loading ? "Deleting..." : "Delete Item"}
        </Button>
      </div>
    </div>
  );
}

function LeaveSessionConfirm({ data, sessionCode, onClose }: { data: any; sessionCode: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [deleteMyData, setDeleteMyData] = useState(false);
  const { openBottomSheet } = useHistoryControls();

  const handleLeave = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserWithCode(sessionCode);
    const deviceId = getOrCreateDeviceId();

    if (supabase) {
      if (deleteMyData) {
        await supabase.from("items").delete().eq("session_code", sessionCode).eq("device_id", deviceId);
      }
      await supabase.from("devices").delete().eq("session_code", sessionCode).eq("device_id", deviceId);
      
      localStorage.removeItem(`pp-host-${sessionCode}`);
      localStorage.removeItem(`pp-joined-${sessionCode}`);
      window.location.href = "/";
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      {data?.isHost && data?.otherDevicesCount > 0 ? (
        <div className="flex flex-col gap-4 p-4 bg-orange-500/10 text-orange-600 rounded-lg border border-orange-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="font-bold text-sm">Host Privileges</p>
          </div>
          <div className="text-sm space-y-2">
            <p>There are {data.otherDevicesCount} other devices connected.</p>
            <p>If you leave now, the session may be left without a host. To transfer privileges, please use the Devices panel.</p>
            <Button 
              variant="secondary" 
              size="sm" 
              className="w-full mt-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border-orange-500/20"
              onClick={() => openBottomSheet("devices")}
            >
              Go to Devices Panel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 px-1">
        <input
          type="checkbox"
          id="delete-data"
          checked={deleteMyData}
          onChange={(e) => setDeleteMyData(e.target.checked)}
          className="mt-1 rounded border-zinc-700 bg-zinc-800"
        />
        <label htmlFor="delete-data" className="text-sm text-muted-foreground cursor-pointer select-none">
          Delete all items shared by this device before leaving.
        </label>
      </div>

      <div className="flex justify-center pt-2">
        <Button 
          variant="destructive" 
          onClick={handleLeave} 
          disabled={loading}
        >
          {loading ? "Leaving..." : "Leave Session"}
        </Button>
      </div>
    </div>
  );
}

function KillSessionConfirm({ sessionCode, onClose }: { sessionCode: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleKill = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserWithCode(sessionCode);
    if (supabase) {
      await supabase.from("sessions").delete().eq("code", sessionCode);
      localStorage.removeItem(`pp-host-${sessionCode}`);
      window.location.href = "/";
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center gap-4 p-4 bg-destructive/10 text-destructive rounded-lg">
        <ShieldAlert className="h-6 w-6" />
        <div className="text-sm font-medium">
          <p className="font-bold mb-1">Warning: Irreversible Action</p>
          <p>This will delete the session and all associated data immediately. All connected devices will be disconnected.</p>
        </div>
      </div>
      <div className="flex justify-center pt-2">
        <Button 
          variant="destructive" 
          onClick={handleKill} 
          disabled={loading}
        >
          {loading ? "Purging..." : "Purge Session"}
        </Button>
      </div>
    </div>
  );
}
