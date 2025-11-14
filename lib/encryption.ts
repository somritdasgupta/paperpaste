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

// Compression utilities for better performance
async function compressFile(file: File): Promise<{ compressedFile: File; compressionRatio: number }> {
  // For images, create a compressed version
  if (file.type.startsWith('image/') && file.size > 500 * 1024) { // 500KB threshold
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: file.lastModified,
              });
              resolve({
                compressedFile,
                compressionRatio: file.size / blob.size
              });
            } else {
              resolve({ compressedFile: file, compressionRatio: 1 });
            }
          },
          file.type,
          0.8 // Compression quality
        );
      };
      
      img.onerror = () => resolve({ compressedFile: file, compressionRatio: 1 });
      img.src = URL.createObjectURL(file);
    });
  }
  
  const msOfficeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-word.document.macroEnabled.12', // .docm
    'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12', // .pptm
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-powerpoint', // .ppt
    'application/pdf', // PDF files can also benefit
  ];
  
  if (msOfficeTypes.includes(file.type) && file.size > 100 * 1024) { 
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Check if CompressionStream is available 
      if (typeof CompressionStream !== 'undefined') {
        const compressionStream = new CompressionStream('gzip');
        const response = new Response(arrayBuffer);
        const compressedResponse = new Response(response.body!.pipeThrough(compressionStream));
        const compressedArrayBuffer = await compressedResponse.arrayBuffer();
        
        // Only use compressed version if it's actually smaller
        if (compressedArrayBuffer.byteLength < arrayBuffer.byteLength) {
          // Create a new file with compressed data but preserve original metadata
          const compressedFile = new File([compressedArrayBuffer], file.name + '.gz.tmp', {
            type: 'application/gzip-compressed',
            lastModified: file.lastModified,
          });
          
          // Store original metadata for decompression
          (compressedFile as any).originalType = file.type;
          (compressedFile as any).originalName = file.name;
          (compressedFile as any).isCompressed = true;
          
          return {
            compressedFile,
            compressionRatio: arrayBuffer.byteLength / compressedArrayBuffer.byteLength
          };
        }
      } else {
        // Fallback: use simple binary optimization for older browsers
        const optimizedBuffer = await optimizeBinaryFile(arrayBuffer);
        if (optimizedBuffer.byteLength < arrayBuffer.byteLength) {
          const optimizedFile = new File([optimizedBuffer], file.name, {
            type: file.type,
            lastModified: file.lastModified,
          });
          
          return {
            compressedFile: optimizedFile,
            compressionRatio: arrayBuffer.byteLength / optimizedBuffer.byteLength
          };
        }
      }
    } catch (error) {
      console.warn('Compression failed, using original file:', error);
    }
  }
  
  // For other file types or if compression failed, return as-is
  return { compressedFile: file, compressionRatio: 1 };
}

async function optimizeBinaryFile(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  console.warn('CompressionStream not supported, compression skipped');
  return arrayBuffer;
}

// Encrypt file data (binary) with compression
export async function encryptFile(file: File, sessionKey: CryptoKey): Promise<{ encryptedData: string; originalName: string; mimeType: string; size: number; compressionRatio?: number }> {
  // Compress file if needed for better performance
  const { compressedFile, compressionRatio } = await compressFile(file);
  const arrayBuffer = await compressedFile.arrayBuffer();
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
  
  // Convert to base64 for storage (handle large files without call stack overflow)
  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < combined.length; i += chunkSize) {
    const chunk = combined.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const encryptedData = btoa(binaryString);
  
  // IMPORTANT: Always use the ORIGINAL file's MIME type, not the compressed file's type
  // This ensures proper file type detection during decryption and download
  return {
    encryptedData,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream', // Use original MIME type
    size: file.size, // Use original size for display
    compressionRatio
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
    
    // Check if this was a compressed file by checking the first few bytes
    const dataView = new DataView(decrypted);
    const isGzipped = decrypted.byteLength >= 2 && dataView.getUint8(0) === 0x1f && dataView.getUint8(1) === 0x8b;
    
    if (isGzipped) {
      try {
        if (typeof DecompressionStream !== 'undefined') {
          const decompressionStream = new DecompressionStream('gzip');
          const response = new Response(decrypted);
          const decompressedResponse = new Response(response.body!.pipeThrough(decompressionStream));
          const decompressedArrayBuffer = await decompressedResponse.arrayBuffer();
          
          // Return decompressed blob with the correct MIME type
          return new Blob([decompressedArrayBuffer], { type: mimeType });
        } else {
          console.warn('DecompressionStream not available, returning compressed data');
          // Fall back to returning the data as-is if decompression isn't available
          return new Blob([decrypted], { type: mimeType });
        }
      } catch (decompressError) {
        console.warn('Decompression failed, using data as-is:', decompressError);
        // If decompression fails, return the data as-is
        return new Blob([decrypted], { type: mimeType });
      }
    }
    
    // Not compressed, return as-is
    return new Blob([decrypted], { type: mimeType });
  } catch (error) {
    console.error('File decryption failed:', error);
    throw new Error('Failed to decrypt file');
  }
}

// Create a download URL for encrypted file with preview support
// Falls back to data URL if createObjectURL is blocked by corporate policies
export async function createEncryptedFileDownloadUrl(encryptedData: string, sessionKey: CryptoKey, mimeType: string, fileName?: string): Promise<string> {
  const blob = await decryptFile(encryptedData, sessionKey, mimeType);
  
  // Blob already has correct MIME type from decryptFile
  // Try to create object URL first
  try {
    const url = URL.createObjectURL(blob);
    
    // Test if blob URLs work by trying to fetch (will fail on corporate networks)
    try {
      await fetch(url, { method: 'HEAD' });
      return url;
    } catch (fetchError) {
      // If HEAD fails, revoke and fall through to data URL
      URL.revokeObjectURL(url);
      throw new Error('Blob URL access blocked');
    }
  } catch (blobError) {
    // Fallback to data URL for restricted environments (work laptops, etc.)
    console.warn('Blob URL blocked by security policy, using data URL fallback');
    
    // Read blob as ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid call stack issues
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);
    
    // Return as data URL (works even with strict CSP)
    return `data:${mimeType};base64,${base64}`;
  }
}

// Helper function to determine original MIME type from filename
function getOriginalMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop();
  const mimeTypeMap: { [key: string]: string } = {
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'docm': 'application/vnd.ms-word.document.macroEnabled.12',
    'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    'pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    'doc': 'application/msword',
    'xls': 'application/vnd.ms-excel',
    'ppt': 'application/vnd.ms-powerpoint',
    'pdf': 'application/pdf',
  };
  
  return mimeTypeMap[extension || ''] || 'application/octet-stream';
}

// Utility to check if content is likely a file (base64 encrypted file data)
export function isEncryptedFileData(content: string): boolean {
  // Encrypted file data will be much longer than typical text
  return content.length > 1000 && /^[A-Za-z0-9+/]+=*$/.test(content);
}

// ======= Zero-Knowledge Encryption Functions =======

// Zero-Knowledge: Timestamp Encryption
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