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

// Encrypt file data (binary)
export async function encryptFile(file: File, sessionKey: CryptoKey): Promise<{ encryptedData: string; originalName: string; mimeType: string; size: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    arrayBuffer
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Convert to base64 for storage
  const encryptedData = btoa(String.fromCharCode(...combined));
  
  return {
    encryptedData,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size
  };
}

// Decrypt file data and create downloadable blob
export async function decryptFile(encryptedData: string, sessionKey: CryptoKey, mimeType: string = 'application/octet-stream'): Promise<Blob> {
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
    
    return new Blob([decrypted], { type: mimeType });
  } catch (error) {
    console.error('File decryption failed:', error);
    throw new Error('Failed to decrypt file');
  }
}

// Create a download URL for encrypted file
export async function createEncryptedFileDownloadUrl(encryptedData: string, sessionKey: CryptoKey, mimeType: string): Promise<string> {
  const blob = await decryptFile(encryptedData, sessionKey, mimeType);
  return URL.createObjectURL(blob);
}

// Utility to check if content is likely a file (base64 encrypted file data)
export function isEncryptedFileData(content: string): boolean {
  // Encrypted file data will be much longer than typical text
  return content.length > 1000 && /^[A-Za-z0-9+/]+=*$/.test(content);
}

// ======= Enhanced Zero-Knowledge Encryption Functions =======

// Enhanced Zero-Knowledge: Timestamp Encryption
export async function encryptTimestamp(timestamp: Date, sessionKey: CryptoKey): Promise<string> {
  return await encryptData(timestamp.toISOString(), sessionKey);
}

export async function decryptTimestamp(encryptedTimestamp: string | null, sessionKey: CryptoKey): Promise<Date> {
  if (!encryptedTimestamp) return new Date();
  
  try {
    const decryptedISOString = await decryptData(encryptedTimestamp, sessionKey);
    return new Date(decryptedISOString);
  } catch (error) {
    console.error("Failed to decrypt timestamp:", error);
    return new Date();
  }
}

// Enhanced Zero-Knowledge: Display ID Encryption
export async function encryptDisplayId(id: string, sessionKey: CryptoKey): Promise<string> {
  return await encryptData(id, sessionKey);
}

export async function decryptDisplayId(encryptedId: string | null, sessionKey: CryptoKey): Promise<string> {
  if (!encryptedId) return "Unknown";
  
  try {
    return await decryptData(encryptedId, sessionKey);
  } catch (error) {
    console.error("Failed to decrypt display ID:", error);
    return "Unknown";
  }
}

// Enhanced Zero-Knowledge: Device Metadata Encryption
export async function encryptDeviceMetadata(metadata: object, sessionKey: CryptoKey): Promise<string> {
  return await encryptData(JSON.stringify(metadata), sessionKey);
}

export async function decryptDeviceMetadata(encryptedMetadata: string | null, sessionKey: CryptoKey): Promise<object> {
  if (!encryptedMetadata) return {};
  
  try {
    const decryptedJSON = await decryptData(encryptedMetadata, sessionKey);
    return JSON.parse(decryptedJSON);
  } catch (error) {
    console.error("Failed to decrypt device metadata:", error);
    return {};
  }
}

// Generate human-readable display ID for items
export function generateDisplayId(): string {
  const adjectives = ['Swift', 'Bright', 'Cool', 'Quick', 'Smart', 'Fresh', 'Clean', 'Sharp', 'Clear', 'Light'];
  const nouns = ['Clip', 'Note', 'File', 'Text', 'Code', 'Item', 'Data', 'Memo', 'Doc', 'Paste'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${adj} ${noun} ${num}`;
}

// Get device metadata for encryption
export function getDeviceMetadata(): object {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString()
  };
}