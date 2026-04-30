#!/usr/bin/env node
/**
 * cleanup-shipstation-manual-duplicates.mjs
 *
 * One-off cleanup. The dual-write bug in processIncomingOrder.js (now fixed)
 * pushed Squarespace orders into ShipStation's Manual Orders store
 * (storeId 1344131), creating duplicates of orders already imported by the
 * native Squarespace integration (storeId 1347853).
 *
 * This script lists awaiting_shipment orders in the Manual Orders store
 * created today and deletes them.
 *
 * Run from the worktree:
 *   node scripts/cleanup-shipstation-manual-duplicates.mjs --dry-run
 *   node scripts/cleanup-shipstation-manual-duplicates.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";

const ENV_PATH = "C:/dev/AI Projects/SHOS/shos-app/.env.local";
const STORE_ID = 1344131;
const BASE = "https://ssapi.shipstation.com";
const APPLY = process.argv.includes("--apply");
const DRY = !APPLY;

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnv(ENV_PATH);
const KEY = env.SHIPSTATION_API_KEY;
const SECRET = env.SHIPSTATION_API_SECRET;

if (!KEY || !SECRET) {
  console.error("Missing SHIPSTATION_API_KEY or SHIPSTATION_API_SECRET in", ENV_PATH);
  process.exit(1);
}

const AUTH = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");

async function ssGet(pathAndQuery) {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    method: "GET",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${pathAndQuery} → ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

async function ssDelete(pathOnly) {
  const res = await fetch(`${BASE}${pathOnly}`, {
    method: "DELETE",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`DELETE ${pathOnly} → ${res.status} ${res.statusText}: ${body}`);
  }
  return body ? JSON.parse(body) : { success: true };
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will delete)" : "DRY-RUN (list only — pass --apply to delete)"}`);
  console.log(`Store: ${STORE_ID} (Manual Orders), status: awaiting_shipment\n`);

  const all = [];
  let page = 1;
  while (true) {
    const data = await ssGet(`/orders?storeId=${STORE_ID}&orderStatus=awaiting_shipment&page=${page}&pageSize=100`);
    const orders = data.orders || [];
    all.push(...orders);
    if (orders.length < 100) break;
    page += 1;
    if (page > 20) break;
  }

  console.log(`Found ${all.length} awaiting_shipment order(s) in Manual Orders store.\n`);
  if (all.length === 0) return;

  for (const o of all) {
    console.log(
      `  orderId=${o.orderId}  orderNumber=${o.orderNumber}  created=${o.createDate}  status=${o.orderStatus}  ship=${o.shipTo?.name || ""}`
    );
  }

  if (DRY) {
    console.log("\nDry-run complete. Re-run with --apply to delete these orders.");
    return;
  }

  console.log("\nDeleting...");
  let ok = 0;
  let fail = 0;
  for (const o of all) {
    try {
      await ssDelete(`/orders/${o.orderId}`);
      console.log(`  ✓ deleted ${o.orderId} (${o.orderNumber})`);
      ok += 1;
    } catch (e) {
      console.error(`  ✗ failed ${o.orderId} (${o.orderNumber}): ${e.message}`);
      fail += 1;
    }
  }
  console.log(`\nDone. Deleted: ${ok}. Failed: ${fail}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
