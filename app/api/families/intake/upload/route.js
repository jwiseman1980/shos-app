import { NextResponse } from "next/server";
import { put, del, list } from "@vercel/blob";

/**
 * POST — Upload a reference image for a design brief.
 * Stores in Vercel Blob under design-refs/{heroSku}/
 * Body: multipart form data with file + heroSku
 */
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const heroSku = formData.get("heroSku") || "unknown";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const filename = `design-refs/${heroSku}/${Date.now()}-${file.name}`;
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error("Upload error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE — Clean up all design ref images for a hero after design is complete.
 * Query param: heroSku
 */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const heroSku = searchParams.get("heroSku");

    if (!heroSku) {
      return NextResponse.json({ success: false, error: "heroSku required" }, { status: 400 });
    }

    const prefix = `design-refs/${heroSku}/`;
    const { blobs } = await list({ prefix });

    if (blobs.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: "No files found" });
    }

    await Promise.all(blobs.map((b) => del(b.url)));

    return NextResponse.json({
      success: true,
      deleted: blobs.length,
      message: `Cleaned up ${blobs.length} design reference file(s)`,
    });
  } catch (err) {
    console.error("Delete refs error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
