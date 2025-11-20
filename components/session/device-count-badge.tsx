"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client";

export default function DeviceCountBadge({ code }: { code: string }) {
  const [count, setCount] = useState(0);
  const supabase = getSupabaseBrowserWithCode(code);

  useEffect(() => {
    if (!supabase) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("session_code", code);
      setCount(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel(`device-count-${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `session_code=eq.${code}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, code]);

  if (count <= 1) return null; // Don't show if only 1 device (self) or 0

  return (
    <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-5 flex items-center justify-center text-[10px] bg-primary/20 text-primary border-primary/20">
      {count}
    </Badge>
  );
}
