import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateSessionKey, decryptData, decryptTimestamp, decryptDisplayId, decryptDeviceName } from "@/lib/encryption";

export async function POST(request: Request) {
  try {
    const { sessionCode, format } = await request.json();

    if (!sessionCode || !format) {
      return NextResponse.json(
        { error: "Session code and format are required" },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();
    
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Check if export is enabled for the session
    const { data: session } = await supabase
      .from("sessions")
      .select("export_enabled")
      .eq("code", sessionCode)
      .single();

    // Default to true if export_enabled is null/undefined (backward compatibility)
    // Only block if explicitly set to false
    if (session?.export_enabled === false) {
      return NextResponse.json(
        { error: "Export is disabled for this session" },
        { status: 403 }
      );
    }

    // Fetch all items for the session
    const { data: items, error } = await supabase
      .from("items")
      .select("*")
      .eq("session_code", sessionCode)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching items:", error);
      return NextResponse.json(
        { error: "Failed to fetch items" },
        { status: 500 }
      );
    }

    // Fetch devices for device name decryption
    const { data: devices } = await supabase
      .from("devices")
      .select("device_id, device_name_encrypted")
      .eq("session_code", sessionCode);

    const deviceMap = new Map();
    if (devices) {
      const sessionKey = await generateSessionKey(sessionCode);
      for (const device of devices) {
        let deviceName = "Anonymous Device";
        if (device.device_name_encrypted) {
          try {
            deviceName = await decryptDeviceName(device.device_name_encrypted, sessionKey);
          } catch (e) {
            console.warn("Failed to decrypt device name");
          }
        }
        deviceMap.set(device.device_id, deviceName);
      }
    }

    // Generate session encryption key
    const sessionKey = await generateSessionKey(sessionCode);

    // Decrypt items with all encrypted fields
    const decryptedItems = await Promise.all(
      (items || []).map(async (item: any) => {
        let content = null;
        if (item.content_encrypted) {
          try {
            content = await decryptData(item.content_encrypted, sessionKey);
          } catch (e) {
            content = "[Unable to decrypt]";
          }
        }

        let fileName = null;
        let fileMimeType = null;
        let fileSize = null;
        if (item.kind === "file") {
          if (item.file_name_encrypted) {
            try {
              fileName = await decryptData(item.file_name_encrypted, sessionKey);
            } catch (e) {
              fileName = "[Encrypted File]";
            }
          }
          if (item.file_mime_type_encrypted) {
            try {
              fileMimeType = await decryptData(item.file_mime_type_encrypted, sessionKey);
            } catch (e) {
              fileMimeType = "unknown";
            }
          }
          if (item.file_size_encrypted) {
            try {
              const sizeStr = await decryptData(item.file_size_encrypted, sessionKey);
              fileSize = parseInt(sizeStr, 10);
            } catch (e) {
              fileSize = null;
            }
          }
        }

        // Decrypt timestamps
        let displayCreatedAt = null;
        if (item.created_at_encrypted) {
          try {
            displayCreatedAt = await decryptTimestamp(item.created_at_encrypted, sessionKey);
          } catch (e) {
            displayCreatedAt = new Date(item.created_at);
          }
        } else {
          displayCreatedAt = new Date(item.created_at);
        }

        // Decrypt display ID
        let displayId = null;
        if (item.display_id_encrypted) {
          try {
            displayId = await decryptDisplayId(item.display_id_encrypted, sessionKey);
          } catch (e) {
            displayId = item.id;
          }
        }

        // Get device name
        const deviceName = deviceMap.get(item.device_id) || "Anonymous Device";

        return {
          id: displayId || item.id,
          kind: item.kind,
          content,
          fileName,
          fileMimeType,
          fileSize,
          createdAt: displayCreatedAt,
          deviceName,
        };
      })
    );

    // Generate export based on format
    if (format === "txt") {
      const textContent = generateTextExport(decryptedItems, sessionCode);
      return new NextResponse(textContent, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="paperpaste-${sessionCode}.txt"`,
        },
      });
    } else if (format === "json") {
      const jsonContent = JSON.stringify(
        {
          sessionCode,
          exportedAt: new Date().toISOString(),
          items: decryptedItems,
        },
        null,
        2
      );
      return new NextResponse(jsonContent, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="paperpaste-${sessionCode}.json"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format. Supported: txt, json" }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export history" },
      { status: 500 }
    );
  }
}

function generateTextExport(items: any[], sessionCode: string): string {
  let text = `PaperPaste Session History\n`;
  text += `Session Code: ${sessionCode}\n`;
  text += `Exported: ${new Date().toLocaleString()}\n`;
  text += `Total Items: ${items.length}\n`;
  text += `${"=".repeat(60)}\n\n`;

  items.forEach((item, index) => {
    text += `Item ${index + 1}`;
    if (item.id) {
      text += ` (ID: ${item.id})`;
    }
    text += ` - ${item.kind.toUpperCase()}\n`;
    text += `Date: ${item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown"}\n`;
    text += `Device: ${item.deviceName || "Anonymous Device"}\n`;
    text += `-`.repeat(60) + `\n`;

    if (item.kind === "file") {
      text += `File: ${item.fileName || "Unknown"}\n`;
      if (item.fileMimeType) {
        text += `Type: ${item.fileMimeType}\n`;
      }
      if (item.fileSize) {
        text += `Size: ${formatFileSize(item.fileSize)}\n`;
      }
      text += `[File content not exported]\n`;
    } else {
      text += `${item.content || "[No content]"}\n`;
    }

    text += `\n`;
  });

  return text;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// PDF export can be added later with jspdf package
// For now, we support TXT and JSON which are more universal
