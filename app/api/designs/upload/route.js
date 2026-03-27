import { NextResponse } from "next/server";
import { uploadDesignSVG } from "@/lib/gdrive";
import { sfUpdate } from "@/lib/salesforce";
import { Readable } from "stream";

/**
 * POST /api/designs/upload — Upload a completed design SVG
 * Multipart form: file (SVG), sku (string), heroId (SF Memorial_Bracelet__c ID)
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

    // Convert file to buffer then to readable stream for Drive API
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    // Upload to Google Drive — pass original filename so size variants are preserved
    // e.g., USMA23-MORTON-7.svg stays as-is instead of being renamed to USMA23-MORTON.svg
    const rawName = file.name || "";
    const originalFileName = rawName.endsWith(".svg") ? rawName : `${sku}.svg`;
    const driveResult = await uploadDesignSVG(stream, sku, originalFileName);

    // Update SF record with design URL and mark as complete
    if (heroId && process.env.SF_LIVE === "true") {
      await sfUpdate("Memorial_Bracelet__c", heroId, {
        Design_Status__c: "Complete",
        Bracelet_Design_Created__c: true,
        Has_Graphic_Design__c: true,
        Design_Brief__c: `Design uploaded: ${driveResult.webViewLink}`,
      });
    }

    return NextResponse.json({
      success: true,
      fileId: driveResult.fileId,
      viewLink: driveResult.webViewLink,
      downloadLink: driveResult.webContentLink,
      fileName: driveResult.fileName,
      message: `Design uploaded for ${sku}`,
    });
  } catch (error) {
    console.error("Design upload error:", error.message);

    // Graceful fallback if Drive not configured
    if (error.message.includes("GDRIVE_DESIGNS_FOLDER_ID") || error.message.includes("service account")) {
      return NextResponse.json({
        success: false,
        mock: true,
        message: "Google Drive not configured — upload skipped. Set GDRIVE_DESIGNS_FOLDER_ID.",
      });
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
