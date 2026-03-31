/**
 * Classify an email by sender and subject into an operational category.
 * Used by the dashboard command center and the daily briefing endpoint.
 *
 * @param {string} from - sender address/name
 * @param {string} subject - email subject line
 * @returns {string} category key
 */
export function classifyEmail(from = "", subject = "") {
  if (/tracy|hutter-cpa/i.test(from)) return "FINANCIAL-CPA";
  if (/sara|bookkeeper/i.test(from)) return "FINANCIAL-BOOKKEEPER";
  if (/rentvine|tailored|abshure|rpm/i.test(from)) return "PROPERTY";
  if (/bracelet|memorial.*order/i.test(subject)) return "BRACELET-REQUEST";
  if (/gold.star|family.*contact|remembrance/i.test(subject)) return "FAMILY";
  if (/squarespace.*donat|donor/i.test(subject)) return "DONOR";
  if (/quickbooks|payroll|intuit/i.test(from)) return "FINANCIAL";
  if (/usps|ups|fedex|shipstation/i.test(from)) return "SHIPPING";
  if (/sagesure|insurance|mortgage|freedom.*mortgage|chase.*mortgage/i.test(from)) return "INSURANCE-MORTGAGE";
  if (/york.*electric|utility/i.test(from)) return "UTILITY";
  return "OTHER";
}

/** Short display label + color for category badges */
export const CATEGORY_STYLES = {
  "FINANCIAL-CPA":        { label: "CPA",       color: "#22c55e" },
  "FINANCIAL-BOOKKEEPER": { label: "Books",      color: "#22c55e" },
  "FINANCIAL":            { label: "Finance",    color: "#22c55e" },
  "PROPERTY":             { label: "Property",   color: "#8b5cf6" },
  "BRACELET-REQUEST":     { label: "Bracelet",   color: "#c4a237" },
  "FAMILY":               { label: "Family",     color: "#ec4899" },
  "DONOR":                { label: "Donor",      color: "#3b82f6" },
  "SHIPPING":             { label: "Shipping",   color: "#f59e0b" },
  "INSURANCE-MORTGAGE":   { label: "Insurance",  color: "#8b5cf6" },
  "UTILITY":              { label: "Utility",    color: "#6b7280" },
  "OTHER":                { label: null,          color: null },
};
