#!/usr/bin/env node
/**
 * extract-heroes.js
 * Reads memorial_site_registry.json and writes a simplified heroes.json seed file.
 */

const fs = require("fs");
const path = require("path");

const SOURCE = path.resolve(
  __dirname,
  "../../steel-hearts-site/data/memorial_site_registry.json"
);
const DEST = path.resolve(__dirname, "../data/heroes.json");

// Read source
const raw = fs.readFileSync(SOURCE, "utf-8");
const registry = JSON.parse(raw);

// Map each record to a simplified hero object
const heroes = registry.map((r) => {
  // Derive anniversaryMonth (1-12) from memorialDate if available
  let anniversaryMonth = null;
  if (r.memorialDate) {
    const parts = r.memorialDate.split("-");
    if (parts.length >= 2) {
      anniversaryMonth = parseInt(parts[1], 10);
    }
  }

  return {
    sfId: r.sfId || r.Id || null,
    fullName: r.fullName || r.Name || null,
    serviceCode: r.serviceCode || null,
    rank: r.rank || null,
    branch: r.serviceLabel || null,
    memorialDate: r.memorialDate || null,
    anniversaryMonth,
    charityName: r.charityName || null,
    activeListing: r.activeListing === "1" || r.activeListing === true,
    familyContactId: r.familyContactId || r.familyContactName || null,
  };
});

// Ensure output directory exists
fs.mkdirSync(path.dirname(DEST), { recursive: true });

// Write output
fs.writeFileSync(DEST, JSON.stringify(heroes, null, 2), "utf-8");

console.log(`Wrote ${heroes.length} heroes to ${DEST}`);
