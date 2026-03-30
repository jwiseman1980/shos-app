import { NextResponse } from "next/server";
import { uploadDesignToStorage } from "@/lib/design-storage";
import { uploadDesignSVG } from "@/lib/gdrive";
import { sfUpdate } from "@/lib/salesforce";
import { getServerClient } from "@/lib/supabase";
import { Readable } from "stream";

/**
 * POST /api/designs/upload — Upload a completed design SVG
 * Multipart form: file (SVG), sku (string), heroId (optional SF ID)
 *
 * Primary: Supabase Storage (canonical design store)
 * Secondary: Google Drive (backup + Ryan's working folder)
 * Also updates: hero design flags in Supabase + Salesforce
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sku = formData.get("sku");
    const heroId = formData.get("heroId");

    if (!file || !sku) {
      return NextResponse.json(
        { error: "file and sku are required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const results = { supabase: null, drive: null };

    // 1. Primary: Upload to Supabase Storage
    try {
      results.supabase = await uploadDesignToStorage(sku, buffer, file.type || "image/svg+xml");
    } catch (err) {
      console.error("Supabase Storage upload failed:", err.message);
    }

    // 2. Secondary: Upload to Google Drive (backup)
    try {
      const stream = Readable.from(buffer);
      const rawName = file.name || "";
      const originalFileName = rawName.endsWith(".svg") ? rawName : `${sku}.svg`;
      results.drive = await uploadDesignSVG(stream, sku, originalFileName);
    } catch (err) {
      console.warn("Google Drive upload failed (non-critical):", err.message);
    }

    // 3. Update hero design flags in Supabase
    const baseSku = sku.replace(/-[67]D?$/, "").replace(/-D$/, "");
    const sb = getServerClient();
    const designUrl = results.supabase?.url || results.drive?.webViewLink || "";
    await sb
      .from("heroes")
      .update({
        bracelet_design_created: true,
        has_graphic_design: true,
        design_status: "Complete",
        design_brief: `Design uploaded: ${designUrl}`,
      })
      .eq("lineitem_sku", baseSku);

    // 4. Update Salesforce if live
    if (heroId && process.env.SF_LIVE === "true") {
      try {
        const is6in = /-6D?$/i.test(sku);
        const sfPayload = {
          Design_Status__c: "Complete",
          Bracelet_Design_Created__c: true,
          Has_Graphic_Design__c: true,
        };
        const link = results.drive?.webViewLink || results.supabase?.url || "";
        if (is6in) {
          sfPayload.Design_Brief_6in__c = `Design uploaded: ${link}`;
        } else {
          sfPayload.Design_Brief__c = `Design uploaded: ${link}`;
        }
        await sfUpdate("Memorial_Bracelet__c", heroId, sfPayload);
      } catch (sfErr) {
        console.warn("SF update failed (non-critical):", sfErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      url: results.supabase?.url || results.drive?.webViewLink || "",
      fileName: results.supabase?.fileName || `${sku}.svg`,
      storage: results.supabase ? "supabase" : "drive",
      driveBackup: !!results.drive,
      message: `Design uploaded for ${sku}`,
    });
  } catch (error) {
    console.error("Design upload error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
