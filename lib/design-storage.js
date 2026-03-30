import { getServerClient } from "@/lib/supabase";

const BUCKET = "designs";

/**
 * Check if a design file exists in Supabase Storage for a given SKU.
 * Checks for: {sku}.svg, {baseSku}.svg, {baseSku}-{size}.svg
 * Returns { exists, url, fileName } or { exists: false }.
 */
export async function checkDesignInStorage(sku) {
  if (!sku) return { exists: false };

  const sb = getServerClient();
  const baseSku = toBaseSku(sku);
  const size = extractSize(sku);

  // Check candidates in priority order
  const candidates = [];
  if (size) candidates.push(`${baseSku}-${size}.svg`);
  candidates.push(`${baseSku}.svg`);
  // Also check full SKU as-is (handles edge cases)
  if (sku !== baseSku && !size) candidates.push(`${sku}.svg`);

  for (const fileName of candidates) {
    const { data } = await sb.storage.from(BUCKET).list("", {
      search: fileName,
      limit: 1,
    });

    if (data && data.length > 0 && data[0].name === fileName) {
      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(fileName);
      return {
        exists: true,
        url: urlData?.publicUrl || "",
        fileName,
      };
    }
  }

  return { exists: false };
}

/**
 * Upload a design file to Supabase Storage.
 * File is named by SKU: {sku}.svg
 * Overwrites if exists (upsert).
 */
export async function uploadDesignToStorage(sku, fileBuffer, contentType = "image/svg+xml") {
  if (!sku) throw new Error("SKU is required");

  const sb = getServerClient();
  const fileName = `${sku}.svg`;

  const { data, error } = await sb.storage
    .from(BUCKET)
    .upload(fileName, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(fileName);

  return {
    success: true,
    fileName,
    path: data?.path,
    url: urlData?.publicUrl || "",
  };
}

/**
 * Get the public URL for a design by SKU.
 */
export function getDesignPublicUrl(sku) {
  const sb = getServerClient();
  const fileName = `${sku}.svg`;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(fileName);
  return data?.publicUrl || "";
}

/**
 * List all designs in storage.
 */
export async function listDesigns(limit = 1000) {
  const sb = getServerClient();
  const { data, error } = await sb.storage.from(BUCKET).list("", {
    limit,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  return (data || []).map((f) => ({
    name: f.name,
    size: f.metadata?.size || 0,
    created: f.created_at,
    url: getDesignPublicUrl(f.name.replace(/\.svg$/, "")),
  }));
}

/**
 * Delete a design from storage.
 */
export async function deleteDesign(sku) {
  const sb = getServerClient();
  const fileName = `${sku}.svg`;
  const { error } = await sb.storage.from(BUCKET).remove([fileName]);
  if (error) throw error;
  return { success: true };
}

// --- Helpers (duplicated from orders.js to avoid circular imports) ---

function toBaseSku(sku) {
  if (!sku) return "";
  return sku
    .replace(/-[67]D$/, "")
    .replace(/-[67]$/, "")
    .replace(/_-D$/, "")
    .replace(/-D$/, "");
}

function extractSize(sku) {
  if (!sku) return null;
  const match = sku.match(/-([67])D?$/);
  return match ? match[1] : null;
}
