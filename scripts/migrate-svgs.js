require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const BUCKET = "designs";

function extractSku(filePath) {
  const name = path.basename(filePath, ".svg");
  const dir = path.basename(path.dirname(filePath));

  // If in a SKU-named subfolder (USNA19-FAIROW/USNA19-FAIROW-6.svg)
  if (/^[A-Z]{2,}-[A-Z]/i.test(dir) && dir !== "svg_upload_temp") return name;

  // Double underscore: USA-BUTCHER__USA-BUTCHER-6.svg
  if (name.includes("__")) {
    const after = name.split("__").pop();
    if (/^[A-Z]{2,}-[A-Z]/i.test(after)) return after;
    return name.split("__")[0];
  }

  return name;
}

async function main() {
  // Read file list from /tmp/svg_list.txt (built by bash find command)
  const listFile = process.platform === "win32"
    ? "C:\\Users\\JosephWiseman\\AppData\\Local\\Temp\\svg_list.txt"
    : "/tmp/svg_list.txt";

  let lines;
  try {
    lines = fs.readFileSync(listFile, "utf-8").trim().split("\n").filter(Boolean);
  } catch {
    console.error("Could not read svg_list.txt — run the bash find command first");
    process.exit(1);
  }

  console.log(`Found ${lines.length} SVGs to upload\n`);

  let ok = 0, fail = 0, skipped = 0;

  for (const line of lines) {
    // Convert /c/Users/... to C:\Users\... for Windows fs
    const winPath = line.replace(/^\/([a-z])\//, (_, d) => d.toUpperCase() + ":\\").replace(/\//g, "\\");

    if (!fs.existsSync(winPath)) {
      console.log("SKIP (not found):", path.basename(winPath));
      skipped++;
      continue;
    }

    const sku = extractSku(winPath);
    const fileName = sku + ".svg";
    const buffer = fs.readFileSync(winPath);

    const { error } = await sb.storage.from(BUCKET).upload(fileName, buffer, {
      contentType: "image/svg+xml",
      upsert: true,
    });

    if (error) {
      console.log("FAIL:", fileName, "-", error.message);
      fail++;
    } else {
      console.log("OK:", fileName);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} uploaded, ${fail} failed, ${skipped} skipped`);

  const { data } = await sb.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "name", order: "asc" } });
  console.log("Total files in designs bucket:", data?.length || 0);
  if (data?.length) {
    for (const f of data) console.log("  ", f.name);
  }
}

main().catch((e) => console.error(e));
