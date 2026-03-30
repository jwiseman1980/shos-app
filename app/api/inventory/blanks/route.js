import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const BLANKS_FILE = path.join(process.cwd(), "data", "blank-stock.json");

async function readBlanks() {
  try {
    const raw = await fs.readFile(BLANKS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { blanks_7in: 0, blanks_6in: 0, updated_at: null, notes: "" };
  }
}

async function writeBlanks(data) {
  data.updated_at = new Date().toISOString();
  await fs.writeFile(BLANKS_FILE, JSON.stringify(data, null, 2));
  return data;
}

/**
 * GET /api/inventory/blanks — Read current blank stock counts
 */
export async function GET() {
  const blanks = await readBlanks();
  return NextResponse.json({ success: true, ...blanks });
}

/**
 * PATCH /api/inventory/blanks — Update blank stock counts
 * Body: { blanks_7in?: number, blanks_6in?: number, notes?: string }
 * Or: { decrement_7in?: number, decrement_6in?: number } to subtract
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const current = await readBlanks();

    if (body.decrement_7in) {
      current.blanks_7in = Math.max(0, (current.blanks_7in || 0) - body.decrement_7in);
    }
    if (body.decrement_6in) {
      current.blanks_6in = Math.max(0, (current.blanks_6in || 0) - body.decrement_6in);
    }
    if (body.blanks_7in !== undefined && !body.decrement_7in) {
      current.blanks_7in = body.blanks_7in;
    }
    if (body.blanks_6in !== undefined && !body.decrement_6in) {
      current.blanks_6in = body.blanks_6in;
    }
    if (body.notes !== undefined) {
      current.notes = body.notes;
    }

    const updated = await writeBlanks(current);
    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
