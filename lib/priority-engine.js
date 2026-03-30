/**
 * Priority Engine — scores and ranks every actionable item in the system.
 *
 * Returns a single sorted queue: item #1 is what you do right now.
 * Items include tasks, ideas, anniversaries, SOPs, donor thank-yous,
 * compliance deadlines, and anything else the org needs to do.
 *
 * Scoring: score = (urgency * 3) + (impact * 2) + (decay * 1.5) + (rotation * 1)
 */

// ---------------------------------------------------------------------------
// Impact scores by item type
// ---------------------------------------------------------------------------
const IMPACT_SCORES = {
  outreach: 9,     // Anniversary emails, family contact
  deadline: 9,     // Compliance, filing, hard dates
  donor: 7,        // Donor stewardship
  order: 6,        // Production, fulfillment
  design: 6,       // Design queue
  recurring: 5,    // SOPs
  task: 5,         // General tasks
  explore: 3,      // Research, investigation
  idea: 1,         // Pipe dreams, what-ifs
};

// ---------------------------------------------------------------------------
// Domain labels for rotation tracking
// ---------------------------------------------------------------------------
const DOMAIN_MAP = {
  family: "family",
  anniversary: "family",
  outreach: "family",
  finance: "finance",
  operations: "operations",
  order: "operations",
  design: "operations",
  comms: "comms",
  social: "comms",
  development: "development",
  donor: "development",
  governance: "governance",
  compliance: "governance",
};

// ---------------------------------------------------------------------------
// Urgency scorer
// ---------------------------------------------------------------------------
function scoreUrgency(item) {
  if (!item.dueDate) {
    // Ideas/explores with no deadline
    return item.itemType === "idea" ? 0 : 1;
  }

  const now = new Date();
  const due = new Date(item.dueDate);
  const daysUntil = (due - now) / (1000 * 60 * 60 * 24);

  if (daysUntil < 0) return 10;       // Overdue
  if (daysUntil < 1) return 8;        // Due today
  if (daysUntil < 7) return 5;        // Due this week
  if (daysUntil < 30) return 3;       // Due this month
  return 1;                            // Far out
}

// ---------------------------------------------------------------------------
// Decay scorer — how long since this item was last touched
// ---------------------------------------------------------------------------
function scoreDecay(item) {
  const lastTouched = item.lastTouchedAt || item.createdAt;
  if (!lastTouched) return 5; // Unknown = moderate

  const daysSince = (Date.now() - new Date(lastTouched).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince > 30) return 10;
  if (daysSince > 14) return 8;
  if (daysSince > 7) return 6;
  if (daysSince > 3) return 4;
  return 1;
}

// ---------------------------------------------------------------------------
// Domain rotation scorer — penalizes domains that were recently worked
// ---------------------------------------------------------------------------
function scoreDomainRotation(item, recentDomains) {
  const domain = DOMAIN_MAP[item.domain] || DOMAIN_MAP[item.itemType] || "general";
  const lastWorked = recentDomains[domain];

  if (!lastWorked) return 5; // Never worked = boost
  const daysSince = (Date.now() - new Date(lastWorked).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince > 7) return 5;
  if (daysSince > 3) return 3;
  if (daysSince > 1) return 1;
  return 0; // Worked today
}

// ---------------------------------------------------------------------------
// Time estimate — uses historical average or defaults
// ---------------------------------------------------------------------------
const DEFAULT_ESTIMATES = {
  outreach: 10,    // Anniversary email: ~10 min
  donor: 5,        // Thank-you email: ~5 min
  recurring: 15,   // SOP: ~15 min
  task: 20,        // General task: ~20 min
  design: 30,      // Design work: ~30 min
  order: 10,       // Order processing: ~10 min
  deadline: 30,    // Compliance: ~30 min
  explore: 45,     // Research: ~45 min
  idea: 15,        // Idea evaluation: ~15 min
};

function getEstimatedMinutes(item, historicalAverages) {
  if (item.estimatedMinutes) return item.estimatedMinutes;
  const avg = historicalAverages?.[item.itemType];
  if (avg) return Math.round(avg);
  return DEFAULT_ESTIMATES[item.itemType] || 15;
}

// ---------------------------------------------------------------------------
// Deep link resolver
// ---------------------------------------------------------------------------
function getDeepLink(item) {
  if (item.deepLink) return item.deepLink;

  switch (item.itemType) {
    case "outreach": return "/anniversaries";
    case "donor": return "/donors";
    case "recurring": return item.sopId ? `/sops/${item.sopId}` : "/comms/social";
    case "design": return "/designs";
    case "order": return "/orders";
    case "deadline": return "/";
    default: return "/tasks";
  }
}

// ---------------------------------------------------------------------------
// Type icons and colors
// ---------------------------------------------------------------------------
const TYPE_META = {
  outreach:  { icon: "\u2764", color: "#e74c3c", label: "Family Outreach" },
  deadline:  { icon: "\u26a0", color: "#e74c3c", label: "Deadline" },
  donor:     { icon: "\u2605", color: "#27ae60", label: "Donor Stewardship" },
  order:     { icon: "\ud83d\udce6", color: "#e67e22", label: "Order" },
  design:    { icon: "\u270e", color: "#3498db", label: "Design" },
  recurring: { icon: "\ud83d\udccb", color: "#8e44ad", label: "SOP" },
  task:      { icon: "\u2611", color: "#c4a237", label: "Task" },
  explore:   { icon: "\ud83d\udd0d", color: "#1abc9c", label: "Research" },
  idea:      { icon: "\ud83d\udca1", color: "#b0b8c4", label: "Idea" },
};

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------
export function scoreItem(item, recentDomains = {}, historicalAverages = {}) {
  const urgency = scoreUrgency(item);
  const impact = IMPACT_SCORES[item.itemType] || 3;
  const decay = scoreDecay(item);
  const rotation = scoreDomainRotation(item, recentDomains);
  const score = (urgency * 3) + (impact * 2) + (decay * 1.5) + (rotation * 1);
  const meta = TYPE_META[item.itemType] || TYPE_META.task;

  return {
    ...item,
    score: Math.round(score * 10) / 10,
    urgencyScore: urgency,
    impactScore: impact,
    decayScore: decay,
    rotationScore: rotation,
    estimatedMinutes: getEstimatedMinutes(item, historicalAverages),
    deepLink: getDeepLink(item),
    icon: meta.icon,
    color: meta.color,
    typeLabel: meta.label,
    domain: DOMAIN_MAP[item.domain] || DOMAIN_MAP[item.itemType] || "general",
    // Why it's ranked here — human-readable
    rankReason: buildRankReason(urgency, impact, decay, rotation, item),
  };
}

function buildRankReason(urgency, impact, decay, rotation, item) {
  const parts = [];
  if (urgency >= 8) parts.push("Due soon");
  else if (urgency >= 10) parts.push("Overdue");
  if (impact >= 7) parts.push("High impact");
  if (decay >= 7) parts.push("Untouched");
  if (rotation >= 4) parts.push("Domain needs attention");
  if (item.itemType === "idea") parts.push("Idea — explore when time allows");
  return parts.join(" \u00b7 ") || "Queued";
}

// ---------------------------------------------------------------------------
// Build the full ranked queue
// ---------------------------------------------------------------------------
export function buildQueue(items, recentDomains = {}, historicalAverages = {}) {
  return items
    .map((item) => scoreItem(item, recentDomains, historicalAverages))
    .sort((a, b) => b.score - a.score);
}
