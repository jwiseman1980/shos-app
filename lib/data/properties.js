import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// GYST Property Management — Data Access Layer
// ---------------------------------------------------------------------------

export async function getProperties() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("gyst_properties")
    .select("*, gyst_property_costs(*)")
    .order("address", { ascending: true });

  if (error) throw new Error(`Properties query failed: ${error.message}`);
  return data || [];
}

export async function getPropertyById(id) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("gyst_properties")
    .select("*, gyst_property_costs(*)")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Property query failed: ${error.message}`);
  return data;
}

export async function getPropertyCosts(propertyId) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("gyst_property_costs")
    .select("*")
    .eq("property_id", propertyId)
    .order("category", { ascending: true })
    .order("item", { ascending: true });

  if (error) throw new Error(`Property costs query failed: ${error.message}`);
  return data || [];
}

/**
 * Compute financial summary for a property + its costs.
 */
export function getPropertySummary(property, costs) {
  const oneTimeCosts = costs.filter((c) => !c.is_recurring);
  const monthlyCosts = costs.filter((c) => c.is_recurring && c.recurring_period === "monthly");
  const annualCosts = costs.filter((c) => c.is_recurring && c.recurring_period === "annual");

  const totalOneTime = oneTimeCosts.reduce((sum, c) => sum + (c.high_estimate || 0), 0);
  const monthlyUtilities = monthlyCosts.reduce((sum, c) => sum + (c.high_estimate || 0), 0);
  const annualMaintenance = annualCosts.reduce((sum, c) => sum + (c.high_estimate || 0), 0);

  // Adapt to existing schema: rental_income, estimated_value, mortgage_balance
  const leaseRate = property.rental_income || property.lease_rate || 0;
  const leaseTermMonths = property.lease_term_months || 24;
  const totalRecurring2yr = (monthlyUtilities * leaseTermMonths) + (annualMaintenance * (leaseTermMonths / 12));

  const grossRevenue = leaseRate * leaseTermMonths;
  const totalInvestment = totalOneTime + totalRecurring2yr;
  const netProfit = grossRevenue - totalInvestment;
  const monthlyNet = leaseRate - monthlyUtilities - (annualMaintenance / 12);
  const paybackMonths = monthlyNet > 0 ? Math.ceil(totalOneTime / monthlyNet) : null;

  const currentValue = property.estimated_value || property.current_value || 0;
  const mortgageBalance = property.mortgage_balance || 0;
  const equity = currentValue - mortgageBalance;

  // Financing breakdown
  const financing = {};
  for (const c of oneTimeCosts) {
    const key = c.financing_method || c.financing || "Cash";
    financing[key] = (financing[key] || 0) + (c.high_estimate || 0);
  }

  // Category totals
  const categoryTotals = {};
  for (const c of oneTimeCosts) {
    const key = c.category || "Other";
    categoryTotals[key] = (categoryTotals[key] || 0) + (c.high_estimate || 0);
  }

  return {
    totalOneTime,
    monthlyUtilities,
    annualMaintenance,
    totalRecurring2yr,
    grossRevenue,
    netProfit,
    totalInvestment,
    paybackMonths,
    equity,
    currentValue,
    leaseRate,
    financing,
    categoryTotals,
    leaseTermMonths,
  };
}
