import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

const BRANCH_TO_ENUM = {
  USA: "Army",
  USN: "Navy",
  USMC: "Marines",
  USAF: "Air Force",
  USSF: "Space Force",
  USCG: "Coast Guard",
  FIRE: "Other",
  Other: "Other",
};

const VALID_ACADEMIES = new Set(["USMA", "USNA", "USAFA", "USCGA", "USMMA"]);

function normalizeLastName(s) {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function buildSku({ academy, gradYear, branchPrefix, lastName }) {
  const ln = normalizeLastName(lastName);
  if (!ln) return null;

  if (academy && VALID_ACADEMIES.has(academy)) {
    const yr = String(gradYear || "").trim();
    const yrSuffix = /^\d{4}$/.test(yr) ? yr.slice(-2) : "";
    return `${academy}${yrSuffix}-${ln}`;
  }
  if (branchPrefix) {
    return `${branchPrefix}-${ln}`;
  }
  return null;
}

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 0) return { rank: null, first: null, last: null };
  if (parts.length === 1) return { rank: null, first: null, last: parts[0] };
  // Heuristic: first token uppercase + short = rank (e.g. CPT, 1LT, MAJ, SGT)
  const looksLikeRank = /^[A-Z0-9/]{2,5}$/.test(parts[0]);
  if (looksLikeRank && parts.length >= 3) {
    return {
      rank: parts[0],
      first: parts[1],
      last: parts.slice(2).join(" "),
    };
  }
  return {
    rank: null,
    first: parts[0],
    last: parts.slice(1).join(" "),
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    name,
    last_name: lastNameInput,
    academy,
    branch,
    grad_year: gradYear,
    memorial_month: memorialMonth,
    memorial_day: memorialDay,
    family_contact_name: familyContactName,
    family_contact_email: familyContactEmail,
    design_notes: designNotes,
  } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const parsed = splitName(name);
  const lastName = (lastNameInput || parsed.last || "").trim();
  if (!lastName) {
    return NextResponse.json({ error: "last_name is required" }, { status: 400 });
  }

  const academyVal = academy && academy !== "None" ? academy : null;
  const branchPrefix = branch || null;

  const sku = buildSku({
    academy: academyVal,
    gradYear,
    branchPrefix,
    lastName,
  });

  if (!sku) {
    return NextResponse.json(
      { error: "Could not generate SKU — pick an Academy or Branch" },
      { status: 400 }
    );
  }

  const branchEnum = academyVal
    ? academyVal
    : BRANCH_TO_ENUM[branchPrefix] || null;

  const sb = getServerClient();

  let familyContactId = null;
  if (familyContactName && familyContactName.trim()) {
    const fcParts = familyContactName.trim().split(/\s+/);
    const fcFirst = fcParts[0];
    const fcLast = fcParts.slice(1).join(" ") || null;
    const { data: contact, error: cErr } = await sb
      .from("contacts")
      .insert({
        first_name: fcFirst,
        last_name: fcLast,
        email: familyContactEmail || null,
      })
      .select("id")
      .single();
    if (cErr) {
      console.warn("[heroes/create] contact insert failed:", cErr.message);
    } else {
      familyContactId = contact.id;
    }
  }

  const memMonth = memorialMonth ? Number(memorialMonth) : null;
  const memDay = memorialDay ? Number(memorialDay) : null;
  let memorialDate = null;
  if (memMonth && memDay) {
    const yr = new Date().getFullYear();
    memorialDate = `${yr}-${String(memMonth).padStart(2, "0")}-${String(memDay).padStart(2, "0")}`;
  }

  const insertPayload = {
    name: name.trim(),
    first_name: parsed.first,
    last_name: lastName,
    rank: parsed.rank,
    branch: branchEnum,
    lineitem_sku: sku,
    memorial_month: memMonth,
    memorial_day: memDay,
    memorial_date: memorialDate,
    design_status: "research",
    design_brief: designNotes && designNotes.trim() ? designNotes.trim() : null,
    family_contact_id: familyContactId,
    active_listing: true,
  };

  const { data: hero, error: insErr } = await sb
    .from("heroes")
    .insert(insertPayload)
    .select("id, name, lineitem_sku")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  let designRequestSent = false;
  try {
    const url = new URL("/api/heroes/request-design", request.url);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        hero_id: hero.id,
        notes: designNotes || "",
      }),
    });
    const data = await res.json();
    designRequestSent = Boolean(data.slack_sent);
  } catch (err) {
    console.warn("[heroes/create] design request failed:", err.message);
  }

  return NextResponse.json({
    success: true,
    hero,
    design_request_sent: designRequestSent,
  });
}
