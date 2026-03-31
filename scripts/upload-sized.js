require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const BUCKET = "designs";

const base = path.join(
  "C:", "Users", "JosephWiseman",
  "OneDrive - Steel-Hearts.org", "AI Projects", "svg_upload_temp"
);

const sizedFiles = [
  ["USA-BUTCHER__USA-BUTCHER-6.svg", "USA-BUTCHER-6.svg"],
  ["USA-BUTCHER__USA-BUTCHER-7.svg", "USA-BUTCHER-7.svg"],
  ["USAFA01-FRESQUES__USAFA01-FRESQUES-6.svg", "USAFA01-FRESQUES-6.svg"],
  ["USAFA01-FRESQUES__USAFA01-FRESQUES-7.svg", "USAFA01-FRESQUES-7.svg"],
  ["USMA02-MOSHIER__USMA02-MOSHIER-6.svg", "USMA02-MOSHIER-6.svg"],
  ["USMA02-MOSHIER__USMA02-MOSHIER-7.svg", "USMA02-MOSHIER-7.svg"],
  ["USMA10-PRASNICKI__USMA10-PRASNICKI-6.svg", "USMA10-PRASNICKI-6.svg"],
  ["USMA10-PRASNICKI__USMA10-PRASNICKI-7.svg", "USMA10-PRASNICKI-7.svg"],
];

async function main() {
  for (const [src, dest] of sizedFiles) {
    const fullPath = path.join(base, src);
    if (!fs.existsSync(fullPath)) {
      console.log("SKIP:", src);
      continue;
    }
    const buffer = fs.readFileSync(fullPath);
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(dest, buffer, { contentType: "image/svg+xml", upsert: true });
    console.log(error ? "FAIL: " + dest + " " + error.message : "OK: " + dest);
  }

  const { data } = await sb.storage
    .from(BUCKET)
    .list("", { limit: 200, sortBy: { column: "name", order: "asc" } });
  console.log("\nTotal designs in bucket:", data?.length);
}

main();
