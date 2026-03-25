import { NextResponse } from "next/server";
import { sfQuery } from "@/lib/salesforce";

/**
 * GET /api/designs/download?sku=USMA23-MORTON
 * Serves the SVG file attached to a Memorial_Bracelet__c record.
 * Finds the hero by SKU, gets the SVG ContentDocument, returns the file.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku");

  if (!sku) {
    return NextResponse.json({ error: "sku parameter required" }, { status: 400 });
  }

  try {
    // Strip size suffix to get base SKU
    const baseSku = sku.replace(/-[67]$/, "").replace(/-[67]D$/, "").replace(/_-D$/, "").replace(/-D$/, "");

    // Find hero
    const heroes = await sfQuery(
      `SELECT Id FROM Memorial_Bracelet__c WHERE Lineitem_sku__c = '${baseSku}' LIMIT 1`
    );

    if (heroes.length === 0) {
      return NextResponse.json({ error: `No hero found for SKU: ${baseSku}` }, { status: 404 });
    }

    // Get SVG files attached to this hero
    const files = await sfQuery(
      `SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileType, ContentDocument.LatestPublishedVersionId
       FROM ContentDocumentLink
       WHERE LinkedEntityId = '${heroes[0].Id}'`
    );

    const svgs = files.filter(
      (f) => f.ContentDocument?.FileType?.toUpperCase() === "SVG"
    );

    if (svgs.length === 0) {
      return NextResponse.json({ error: `No SVG found for ${baseSku}` }, { status: 404 });
    }

    // Get the file content via ContentVersion
    const versionId = svgs[0].ContentDocument.LatestPublishedVersionId;
    const title = svgs[0].ContentDocument.Title;

    // Get access token for direct download
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

    // Download the file body
    const fileRes = await fetch(
      `${instance_url}/services/data/v62.0/sobjects/ContentVersion/${versionId}/VersionData`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!fileRes.ok) {
      return NextResponse.json({ error: "Failed to download file from Salesforce" }, { status: 500 });
    }

    const fileBuffer = await fileRes.arrayBuffer();

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${title}.svg"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("SVG download error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
