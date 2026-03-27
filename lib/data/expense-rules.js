/**
 * Chase transaction categorization rules.
 * Each rule matches a regex against the transaction description.
 * Rules are evaluated in order — first match wins.
 *
 * Categories:
 *   - Payroll & Taxes
 *   - Software & Subscriptions
 *   - Marketing & Advertising
 *   - Shipping & Fulfillment
 *   - Inventory & Materials
 *   - Professional Services
 *   - Other / Miscellaneous
 *
 * Excluded entries are flagged (Is_Excluded__c) and not counted as expenses:
 *   - Internal transfers between checking and CC
 *   - Squarespace payment deposits (already tracked in sales)
 */

export const EXPENSE_CATEGORIES = [
  "Payroll & Taxes",
  "Software & Subscriptions",
  "Marketing & Advertising",
  "Shipping & Fulfillment",
  "Inventory & Materials",
  "Professional Services",
  "Other / Miscellaneous",
];

export const CATEGORIZATION_RULES = [
  // ── Exclusions (not real expenses) ──
  { pattern: /PAYMENT THANK YOU/i, exclude: true, reason: "CC payment received" },
  { pattern: /CHASE CREDIT CRD/i, exclude: true, reason: "CC payment transfer" },
  { pattern: /Payment to Chase card/i, exclude: true, reason: "CC payment transfer" },
  { pattern: /SQUARESPACE\s*PAY/i, exclude: true, reason: "SQ revenue deposit (tracked in sales)" },
  { pattern: /SQ\s*\*/i, exclude: true, reason: "SQ revenue deposit (tracked in sales)" },
  { pattern: /SQUAREUP/i, exclude: true, reason: "SQ revenue deposit (tracked in sales)" },

  // ── Payroll & Taxes ──
  { pattern: /INTUIT\s*PAYROLL/i, category: "Payroll & Taxes", vendor: "Intuit Payroll" },
  { pattern: /GUSTO/i, category: "Payroll & Taxes", vendor: "Gusto" },
  { pattern: /INTUIT\s*TAX/i, category: "Payroll & Taxes", vendor: "Intuit Tax" },
  { pattern: /VA\s*DEPT\s*TAX/i, category: "Payroll & Taxes", vendor: "VA Dept of Taxation" },
  { pattern: /VIRGINIA\s*TAX/i, category: "Payroll & Taxes", vendor: "VA Dept of Taxation" },
  { pattern: /IRS/i, category: "Payroll & Taxes", vendor: "IRS" },

  // ── Software & Subscriptions ──
  { pattern: /ANTHROPIC/i, category: "Software & Subscriptions", vendor: "Anthropic" },
  { pattern: /CLAUDE\.?AI/i, category: "Software & Subscriptions", vendor: "Claude AI" },
  { pattern: /OPENAI/i, category: "Software & Subscriptions", vendor: "OpenAI" },
  { pattern: /NOTION/i, category: "Software & Subscriptions", vendor: "Notion" },
  { pattern: /ZAPIER/i, category: "Software & Subscriptions", vendor: "Zapier" },
  { pattern: /ADOBE/i, category: "Software & Subscriptions", vendor: "Adobe" },
  { pattern: /CANVA/i, category: "Software & Subscriptions", vendor: "Canva" },
  { pattern: /GOOGLE/i, category: "Software & Subscriptions", vendor: "Google" },
  { pattern: /VERCEL/i, category: "Software & Subscriptions", vendor: "Vercel" },
  { pattern: /INTUIT\s*\*QBOOKS/i, category: "Software & Subscriptions", vendor: "QuickBooks" },
  { pattern: /QUICKBOOKS/i, category: "Software & Subscriptions", vendor: "QuickBooks" },
  { pattern: /SHIPSTATION/i, category: "Software & Subscriptions", vendor: "ShipStation" },
  { pattern: /SQUARESPACE/i, category: "Software & Subscriptions", vendor: "Squarespace" },

  // ── Marketing & Advertising ──
  { pattern: /FACEBK/i, category: "Marketing & Advertising", vendor: "Meta Ads" },
  { pattern: /FB\s+\*/i, category: "Marketing & Advertising", vendor: "Meta Ads" },
  { pattern: /META\s*ADS/i, category: "Marketing & Advertising", vendor: "Meta Ads" },
  { pattern: /INSTAGRAM/i, category: "Marketing & Advertising", vendor: "Instagram Ads" },

  // ── Shipping & Fulfillment ──
  { pattern: /USPS/i, category: "Shipping & Fulfillment", vendor: "USPS" },
  { pattern: /PIRATE\s*SHIP/i, category: "Shipping & Fulfillment", vendor: "Pirate Ship" },
  { pattern: /PRINTFUL/i, category: "Shipping & Fulfillment", vendor: "Printful" },
  { pattern: /UPS\b/i, category: "Shipping & Fulfillment", vendor: "UPS" },
  { pattern: /FEDEX/i, category: "Shipping & Fulfillment", vendor: "FedEx" },
  { pattern: /STAMPS\.COM/i, category: "Shipping & Fulfillment", vendor: "Stamps.com" },

  // ── Inventory & Materials ──
  { pattern: /SP\s*WHOLESALE\s*JEWELRY/i, category: "Inventory & Materials", vendor: "Wholesale Jewelry" },
  { pattern: /WHOLESALE\s*JEWELRY/i, category: "Inventory & Materials", vendor: "Wholesale Jewelry" },
  { pattern: /AMAZON/i, category: "Inventory & Materials", vendor: "Amazon" },
  { pattern: /AMZN/i, category: "Inventory & Materials", vendor: "Amazon" },

  // ── Professional Services ──
  { pattern: /SKETCHY\s*ALIAS/i, category: "Professional Services", vendor: "Sketchy Alias (Design)" },
  { pattern: /SARA\s*CURRAN/i, category: "Professional Services", vendor: "Sara Curran (Bookkeeper)" },
  { pattern: /HUTTER/i, category: "Professional Services", vendor: "Hutter CPA (Tracy)" },
];

/**
 * Categorize a single transaction description.
 * @param {string} description — raw bank description
 * @returns {{ category: string|null, vendor: string|null, exclude: boolean, reason: string|null }}
 */
export function categorizeTransaction(description) {
  const desc = description || "";
  for (const rule of CATEGORIZATION_RULES) {
    if (rule.pattern.test(desc)) {
      if (rule.exclude) {
        return { category: null, vendor: null, exclude: true, reason: rule.reason };
      }
      return { category: rule.category, vendor: rule.vendor, exclude: false, reason: null };
    }
  }
  return { category: "Other / Miscellaneous", vendor: null, exclude: false, reason: null };
}
