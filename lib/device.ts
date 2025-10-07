"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateAnonymousDeviceId } from "@/lib/encryption"

// Device names for identification
const DEVICE_ADJECTIVES = [
  "Swift", "Bright", "Cool", "Smart", "Quick", "Bold", "Calm", "Warm", 
  "Sharp", "Clean", "Fresh", "Noble", "Wise", "Pure", "Strong", "Light"
]

const DEVICE_NOUNS = [
  "Fox", "Wolf", "Eagle", "Lion", "Tiger", "Bear", "Hawk", "Owl",
  "Dolphin", "Shark", "Phoenix", "Dragon", "Falcon", "Panther", "Raven", "Lynx"
]

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-temp-id';
  
  const key = "pp-device-id"
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = generateAnonymousDeviceId()
  localStorage.setItem(key, id)
  return id
}

export function generateDeviceName(): string {
  const adj = DEVICE_ADJECTIVES[Math.floor(Math.random() * DEVICE_ADJECTIVES.length)]
  const noun = DEVICE_NOUNS[Math.floor(Math.random() * DEVICE_NOUNS.length)]
  return `${adj} ${noun}`
}

export function getOrCreateDeviceName(): string {
  if (typeof window === 'undefined') return 'Server Device';
  
  const key = "pp-device-name"
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const name = generateDeviceName()
  localStorage.setItem(key, name)
  return name
}

export function getDeviceInfo() {
  return {
    id: getOrCreateDeviceId(),
    name: getOrCreateDeviceName(),
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'Unknown',
    isMobile: /Android|webOS|iPhone|iPad|BlackBerry|IE|Opera Mini/i.test(navigator.userAgent)
  }
}

export function heartbeat(supabase: SupabaseClient, code: string, deviceId: string) {
  let retryCount = 0;
  const maxRetries = 3;
  
  // update last_seen every 10s with retry logic
  const update = async () => {
    try {
      const { error } = await supabase
        .from("devices")
        .update({ last_seen: new Date().toISOString() })
        .eq("session_code", code)
        .eq("device_id", deviceId);
      
      if (error) {
        console.warn("Heartbeat error:", error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error("Max heartbeat retries reached, device may be disconnected");
        }
      } else {
        retryCount = 0; // Reset on success
      }
    } catch (e) {
      console.warn("Heartbeat failed:", e);
      retryCount++;
    }
  }
  
  update(); // Initial heartbeat
  const iv = setInterval(update, 10_000); // Every 10 seconds

  const ch = supabase
    .channel(`kicked-${code}-${deviceId}`)
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "devices", filter: `session_code=eq.${code}` },
      (payload) => {
        if ((payload.old as any)?.device_id === deviceId) {
          alert("You have been removed from this session.")
          window.location.href = "/"
        }
      },
    )
    .subscribe()

  return () => {
    clearInterval(iv)
    supabase.removeChannel(ch)
  }
}
