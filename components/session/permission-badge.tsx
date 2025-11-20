"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device";
import { Crown, EyeOff, Snowflake } from "lucide-react";

export default function PermissionBadge({ code }: { code: string }) {
  const [permissions, setPermissions] = useState<{
    isHost: boolean;
    canView: boolean;
    isFrozen: boolean;
  }>({ isHost: false, canView: true, isFrozen: false });
  
  const supabase = getSupabaseBrowserWithCode(code);
  const [deviceId, setDeviceId] = useState<string>("");

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    if (!supabase || !deviceId) return;

    const fetchPermissions = async () => {
      const { data } = await supabase
        .from("devices")
        .select("is_host, can_view, is_frozen")
        .eq("session_code", code)
        .eq("device_id", deviceId)
        .single();

      if (data) {
        setPermissions({
          isHost: data.is_host,
          canView: data.can_view !== false,
          isFrozen: data.is_frozen,
        });
      }
    };

    fetchPermissions();

    const channel = supabase
      .channel(`my-permissions-badge-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        (payload) => {
          if (payload.new.device_id === deviceId) {
             setPermissions({
              isHost: payload.new.is_host,
              canView: payload.new.can_view !== false,
              isFrozen: payload.new.is_frozen,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, code, deviceId]);

  if (permissions.isHost) {
    return (
      <Badge variant="default" className="h-7 sm:h-8 gap-1 bg-amber-500 hover:bg-amber-600 text-white border-amber-600">
        <Crown className="h-3 w-3" />
        <span className="hidden sm:inline">Host</span>
      </Badge>
    );
  }

  if (!permissions.canView) {
    return (
      <Badge variant="destructive" className="h-7 sm:h-8 gap-1">
        <EyeOff className="h-3 w-3" />
        <span className="hidden sm:inline">Hidden</span>
      </Badge>
    );
  }

  if (permissions.isFrozen) {
    return (
      <Badge variant="secondary" className="h-7 sm:h-8 gap-1 bg-blue-500/10 text-blue-500 border-blue-200">
        <Snowflake className="h-3 w-3" />
        <span className="hidden sm:inline">Frozen</span>
      </Badge>
    );
  }

  return null;
}
