// Session validation utility
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateDeviceId } from "./device";

export interface SessionValidationResult {
  isValid: boolean;
  isRegistered: boolean;
  needsRejoin: boolean;
  error?: string;
}

export async function validateSession(
  supabase: SupabaseClient | null,
  code: string
): Promise<SessionValidationResult> {
  if (!supabase) {
    return {
      isValid: false,
      isRegistered: false,
      needsRejoin: true,
      error: "Database connection not available"
    };
  }

  try {
    const deviceId = getOrCreateDeviceId();

    // Check if session exists
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("code", code)
      .single();

    if (sessionError || !session) {
      return {
        isValid: false,
        isRegistered: false,
        needsRejoin: true,
        error: "Session not found or expired"
      };
    }

    // Check if device is registered
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*")
      .eq("session_code", code)
      .eq("device_id", deviceId)
      .single();

    if (deviceError || !device) {
      return {
        isValid: true,
        isRegistered: false,
        needsRejoin: true,
        error: "Device not registered for this session"
      };
    }

    // Check if device is still active (updated within last 30 minutes - more lenient)
    const lastSeen = new Date(device.last_seen);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    if (lastSeen < thirtyMinutesAgo) {
      return {
        isValid: true,
        isRegistered: true,
        needsRejoin: true,
        error: "Device session expired, please rejoin"
      };
    }

    return {
      isValid: true,
      isRegistered: true,
      needsRejoin: false
    };

  } catch (error: any) {
    return {
      isValid: false,
      isRegistered: false,
      needsRejoin: true,
      error: error?.message || "Validation failed"
    };
  }
}

export function setSessionJoined(code: string, deviceId: string) {
  localStorage.setItem(`pp-session-${code}-${deviceId}`, Date.now().toString());
}

export function getSessionJoined(code: string, deviceId: string): number | null {
  const timestamp = localStorage.getItem(`pp-session-${code}-${deviceId}`);
  return timestamp ? parseInt(timestamp, 10) : null;
}

export function clearSessionJoined(code: string, deviceId: string) {
  localStorage.removeItem(`pp-session-${code}-${deviceId}`);
}