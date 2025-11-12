import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateSessionKey, decryptData } from "@/lib/encryption";

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

    if (!session?.export_enabled) {
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

    // Generate session encryption key
    const sessionKey = await generateSessionKey(sessionCode);

    // Decrypt items
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
        if (item.kind === "file" && item.file_name_encrypted) {
          try {
            fileName = await decryptData(item.file_name_encrypted, sessionKey);
          } catch (e) {
            fileName = "[Encrypted File]";
          }
        }

        return {
          kind: item.kind,
          content,
          fileName,
          createdAt: item.created_at,
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
    text += `Item ${index + 1} - ${item.kind.toUpperCase()}\n`;
    text += `Date: ${new Date(item.createdAt).toLocaleString()}\n`;
    text += `-`.repeat(60) + `\n`;

    if (item.kind === "file") {
      text += `File: ${item.fileName || "Unknown"}\n`;
    } else {
      text += `${item.content || "[No content]"}\n`;
    }

    text += `\n`;
  });

  return text;
}

// PDF export can be added later with jspdf package
// For now, we support TXT and JSON which are more universal
