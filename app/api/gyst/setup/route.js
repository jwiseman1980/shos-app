/**
 * GYST Property Setup / Seed API
 *
 * POST /api/gyst/setup — Seeds the 111 Schoolfield property and costs.
 *
 * Prerequisites: Run this SQL in Supabase first:
 *
 * CREATE TABLE gyst_properties (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   name TEXT NOT NULL,
 *   address TEXT,
 *   city TEXT,
 *   state TEXT,
 *   zip TEXT,
 *   purchase_price NUMERIC,
 *   purchase_date DATE,
 *   current_value NUMERIC,
 *   mortgage_rate NUMERIC,
 *   lot_sqft INTEGER,
 *   beds INTEGER,
 *   baths INTEGER,
 *   sqft INTEGER,
 *   lease_rate NUMERIC,
 *   lease_term_months INTEGER,
 *   lease_start DATE,
 *   lease_end DATE,
 *   tenant_name TEXT,
 *   status TEXT DEFAULT 'active',
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * CREATE TABLE gyst_property_costs (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   property_id UUID REFERENCES gyst_properties(id) ON DELETE CASCADE,
 *   category TEXT NOT NULL,
 *   item TEXT NOT NULL,
 *   low_estimate NUMERIC,
 *   high_estimate NUMERIC,
 *   actual NUMERIC,
 *   status TEXT DEFAULT 'planned',
 *   timing TEXT,
 *   financing TEXT,
 *   is_recurring BOOLEAN DEFAULT false,
 *   recurring_period TEXT,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 */

import { getServerClient } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();

  // Check if property already exists
  const { data: existing } = await sb
    .from("gyst_properties")
    .select("id")
    .eq("name", "111 Schoolfield Dr")
    .limit(1);

  if (existing?.length > 0) {
    return Response.json({
      success: true,
      message: "Property already exists",
      propertyId: existing[0].id,
    });
  }

  // Insert property
  const { data: property, error: propError } = await sb
    .from("gyst_properties")
    .insert({
      name: "111 Schoolfield Dr",
      address: "111 Schoolfield Dr",
      city: "Carlisle",
      state: "PA",
      zip: "17013",
      purchase_price: 245000,
      purchase_date: "2014-01-17",
      current_value: 406000,
      mortgage_rate: 0.0225,
      lot_sqft: 18295,
      beds: 4,
      baths: 2,
      sqft: 2356,
      lease_rate: 5000,
      lease_term_months: 24,
      lease_start: "2026-07-01",
      lease_end: "2028-06-30",
      tenant_name: "Brazilian Army Officer (Prospect)",
      status: "turnover",
    })
    .select()
    .single();

  if (propError) {
    return Response.json({
      error: `Failed to create property: ${propError.message}`,
      hint: "Make sure the gyst_properties table exists. See SQL in route comments.",
    }, { status: 500 });
  }

  const pid = property.id;

  // Build cost items
  const costs = buildSeedCosts(pid);

  const { error: costError } = await sb
    .from("gyst_property_costs")
    .insert(costs);

  if (costError) {
    return Response.json({
      error: `Property created but costs failed: ${costError.message}`,
      propertyId: pid,
      hint: "Make sure the gyst_property_costs table exists. See SQL in route comments.",
    }, { status: 500 });
  }

  return Response.json({
    success: true,
    propertyId: pid,
    costsInserted: costs.length,
  });
}

function buildSeedCosts(propertyId) {
  const items = [];

  function add(category, item, high, opts = {}) {
    items.push({
      property_id: propertyId,
      category,
      item,
      high_estimate: high,
      low_estimate: Math.round(high * 0.65),
      status: "planned",
      timing: opts.timing || null,
      financing: opts.financing || "Cash",
      is_recurring: opts.is_recurring || false,
      recurring_period: opts.recurring_period || null,
    });
  }

  // Renovation
  add("Renovation", "Cabinet refacing + new hardware", 4500, { timing: "Turnover week", financing: "HELOC" });
  add("Renovation", "Interior paint — whole house", 5000, { timing: "Turnover week", financing: "HELOC" });
  add("Renovation", "Carpet — all upstairs", 4500, { timing: "Turnover week", financing: "HELOC" });
  add("Renovation", "Pressure washing exterior", 500, { timing: "Now", financing: "Cash" });
  add("Renovation", "Small fixes (TBD from Tabitha)", 2000, { timing: "Now", financing: "Cash" });

  // Landscaping
  add("Landscaping", "Initial cleanup, mulch, trim", 2400, { timing: "Now", financing: "Cash" });

  // Furnishing
  add("Furnishing", "Sofa + loveseat", 2500, { financing: "0% APR Card" });
  add("Furnishing", "Dining table + 6 chairs", 1000, { financing: "0% APR Card" });
  add("Furnishing", "2 twin beds + frames", 1000, { financing: "0% APR Card" });
  add("Furnishing", "2 twin mattresses", 600, { financing: "0% APR Card" });
  add("Furnishing", "3 dressers", 1200, { financing: "0% APR Card" });
  add("Furnishing", "4 nightstands", 500, { financing: "0% APR Card" });
  add("Furnishing", "Desk / workspace", 350, { financing: "0% APR Card" });
  add("Furnishing", "Kitchen essentials", 600, { financing: "0% APR Card" });
  add("Furnishing", "Linens, towels, pillows, comforters", 700, { financing: "0% APR Card" });
  add("Furnishing", "Lamps, curtains, rugs, decor", 600, { financing: "0% APR Card" });
  add("Furnishing", "Patio furniture set", 1000, { financing: "0% APR Card" });
  add("Furnishing", "BBQ / grill", 600, { financing: "0% APR Card" });

  // Utilities (monthly recurring)
  add("Utilities", "Electric", 250, { is_recurring: true, recurring_period: "monthly" });
  add("Utilities", "Gas/heat", 200, { is_recurring: true, recurring_period: "monthly" });
  add("Utilities", "Water/sewer", 100, { is_recurring: true, recurring_period: "monthly" });
  add("Utilities", "Trash", 50, { is_recurring: true, recurring_period: "monthly" });
  add("Utilities", "Internet", 80, { is_recurring: true, recurring_period: "monthly" });

  // Maintenance (annual recurring)
  add("Maintenance", "Weekly mowing + edging", 3500, { is_recurring: true, recurring_period: "annual" });
  add("Maintenance", "Snow removal", 2500, { is_recurring: true, recurring_period: "annual" });
  add("Maintenance", "Fall leaf cleanup", 500, { is_recurring: true, recurring_period: "annual" });
  add("Maintenance", "Fertilizer + weed treatment", 600, { is_recurring: true, recurring_period: "annual" });
  add("Maintenance", "Annual mulch refresh", 600, { is_recurring: true, recurring_period: "annual" });
  add("Maintenance", "Bush/hedge trim", 500, { is_recurring: true, recurring_period: "annual" });

  return items;
}
