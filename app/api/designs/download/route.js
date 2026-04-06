import { NextResponse } from "next/server";
import { checkDesignInStorage, uploadDesignToStorage } from "@/lib/design-storage";
import { getServerClient } from "@/lib/supabase";
import { sfQuery } from "@/lib/salesforce";

/**
 * GET /api/designs/download?sku=USMA23-MORTON-6
 *
 * Size-aware SVG download. Checks in order:
 * 1. Supabase Storage — exact SKU match (e.g., USMA23-MORTON-6.svg)
 * 2. Supabase Storage — base SKU fallback (e.g., USMA23-MORTON.svg)
 * 3. Salesforce — attached SVGs on the Memorial_Bracelet__c record
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku");

  if (!sku) {
    return NextResponse.json({ error: "sku parameter required" }, { status: 400 });
  }

  try {
    const sizeMatch = sku.match(/-([67])D?$/);
    const size = sizeMatch ? sizeMatch[1] : null;
    const baseSku = sku.replace(/-[67]D?$/, "").replace(/_-D$/, "").replace(/-D$/, "");

    // --- 1. Check Supabase Storage (canonical, size-aware) ---
    const sb = getServerClient();
    const BUCKET = "designs";

    // Try exact SKU first, then sized variant, then base SKU as last resort
    const candidates = [sku];
    if (size) {
      const sizedName = `${baseSku}-${size}`;
      if (!candidates.includes(sizedName)) candidates.push(sizedName);
    }
    // Always try base SKU as fallback — having the design beats a 404
    if (!candidates.includes(baseSku)) candidates.push(baseSku);

    // Always label the download with the requested SKU (including size)
    const downloadName = `${sku}.svg`;

    for (const candidate of candidates) {
      const fileName = `${candidate}.svg`;
      const { data: files } = await sb.storage.from(BUCKET).list("", { search: fileName, limit: 1 });

      if (files && files.length > 0 && files[0].name === fileName) {
        const { data: blob } = await sb.storage.from(BUCKET).download(fileName);
        if (blob) {
          const buffer = await blob.arrayBuffer();
          return new NextResponse(buffer, {
            headers: {
              "Content-Type": "image/svg+xml",
              "Content-Disposition": `attachment; filename="${downloadName}"`,
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }

    // --- 2. Fallback: Salesforce attachments ---
    const heroes = await sfQuery(
      `SELECT Id FROM Memorial_Bracelet__c WHERE Lineitem_sku__c = '${baseSku}' LIMIT 1`
    );

    if (heroes.length === 0) {
      return NextResponse.json({ error: `No hero found for SKU: ${baseSku}` }, { status: 404 });
    }

    const files = await sfQuery(
      `SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileType, ContentDocument.LatestPublishedVersionId
       FROM ContentDocumentLink
       WHERE LinkedEntityId = '${heroes[0].Id}'`
    );

    const svgs = files.filter(
      (f) => f.ContentDocument?.FileType?.toUpperCase() === "SVG"
    );

    if (svgs.length === 0) {
      return NextResponse.json({ error: `No SVG found for ${sku}` }, { status: 404 });
    }

    // Size-specific match in SF attachment titles
    let targetSvg = null;
    if (size && svgs.length > 1) {
      targetSvg = svgs.find((f) => {
        const title = (f.ContentDocument?.Title || "").toUpperCase();
        if (title.includes(`-${size}`) || title.includes(`_${size}`)) return true;
        if (size === "6" && (title.includes("FEMALE") || title.includes("SMALL"))) return true;
        return false;
      });
    }
    if (!targetSvg) targetSvg = svgs[0];

    const versionId = targetSvg.ContentDocument.LatestPublishedVersionId;
    const title = targetSvg.ContentDocument.Title;

    const tokenRes = await fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.SF_CLIENT_ID,
        refresh_token: process.env.SF_REFRESH_TOKEN,
      }),
    });
    const { access_token, instance_url } = await tokenRes.json();

    const fileRes = await fetch(
      `${instance_url}/services/data/v62.0/sobjects/ContentVersion/${versionId}/VersionData`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!fileRes.ok) {
      return NextResponse.json({ error: "Failed to download file from Salesforce" }, { status: 500 });
    }

    const fileBuffer = await fileRes.arrayBuffer();

    // Auto-migrate: copy SF design to Supabase Storage so detection works next time
    try {
      await uploadDesignToStorage(sku, Buffer.from(fileBuffer));
      console.log(`Auto-migrated ${sku}.svg from Salesforce to Supabase Storage`);
    } catch (migErr) {
      console.warn(`Auto-migrate to storage failed for ${sku}:`, migErr.message);
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${sku}.svg"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("SVG download error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
