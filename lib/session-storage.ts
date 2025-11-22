// Session persistence for auto-reconnect
export interface StoredSession {
  sessionCode: string;
  deviceId: string;
  sessionKeyData: JsonWebKey;
  timestamp: number;
}

const SESSION_KEY = "paperpaste_active_session";
const SESSION_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours

export async function saveSession(sessionCode: string, deviceId: string, sessionKey: CryptoKey) {
  try {
    const keyData = await crypto.subtle.exportKey("jwk", sessionKey);
    const session: StoredSession = {
      sessionCode,
      deviceId,
      sessionKeyData: keyData,
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    console.log("[SESSION-STORAGE] Saved session:", sessionCode, deviceId);
  } catch (error) {
    console.error("[SESSION-STORAGE] Failed to save session:", error);
  }
}

export async function getStoredSession(): Promise<{ sessionCode: string; deviceId: string; sessionKey: CryptoKey } | null> {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      console.log("[SESSION-STORAGE] No stored session in localStorage");
      return null;
    }

    const session: StoredSession = JSON.parse(stored);
    console.log("[SESSION-STORAGE] Found stored session:", session.sessionCode, session.deviceId);
    
    // Check expiry
    if (Date.now() - session.timestamp > SESSION_EXPIRY) {
      console.log("[SESSION-STORAGE] Session expired");
      clearStoredSession();
      return null;
    }

    // Import key
    const sessionKey = await crypto.subtle.importKey(
      "jwk",
      session.sessionKeyData,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    console.log("[SESSION-STORAGE] Successfully restored session");
    return {
      sessionCode: session.sessionCode,
      deviceId: session.deviceId,
      sessionKey,
    };
  } catch (error) {
    console.error("[SESSION-STORAGE] Failed to restore session:", error);
    clearStoredSession();
    return null;
  }
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}
