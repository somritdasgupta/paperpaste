/**
 * End-to-End Encryption Utilities
 * Provides client-side encryption for session data with zero-knowledge architecture
 */

// Generate a session-specific encryption key from session code
export async function generateSessionKey(sessionCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionCode + 'paperpaste-encryption-salt-2025'),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('paperpaste-session-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data with session key
export async function encryptData(data: string, sessionKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    encoder.encode(data)
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Decrypt data with session key
export async function decryptData(encryptedData: string, sessionKey: CryptoKey): Promise<string> {
  try {
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Encrypted Content - Unable to Decrypt]';
  }
}

// Generate anonymous device identifier
export function generateAnonymousDeviceId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '').substring(0, 12);
}

// Encrypt device name for anonymity
export async function encryptDeviceName(deviceName: string, sessionKey: CryptoKey): Promise<string> {
  return encryptData(deviceName, sessionKey);
}

// Decrypt device name
export async function decryptDeviceName(encryptedName: string, sessionKey: CryptoKey): Promise<string> {
  return decryptData(encryptedName, sessionKey);
}