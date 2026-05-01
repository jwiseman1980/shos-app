const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getMonthName(monthNum) {
  return MONTH_NAMES[(monthNum - 1)] || "";
}

export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getDayOfMonth(dateStr) {
  if (!dateStr) return null;
  return parseInt(dateStr.slice(8, 10), 10);
}

export function yearsSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  return now.getFullYear() - d.getFullYear();
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Days from today until the next occurrence of (month, day).
 * If the anniversary already passed this year, returns days until next year.
 * Returns 0 if the anniversary is today.
 */
export function daysUntilAnniversary(month, day, fromDate = new Date()) {
  if (!month || !day) return null;
  const m = Number(month);
  const d = Number(day);
  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  let target = new Date(today.getFullYear(), m - 1, d);
  if (target < today) {
    target = new Date(today.getFullYear() + 1, m - 1, d);
  }
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function getNextMonth(month) {
  return month === 12 ? 1 : month + 1;
}

export function getNextMonthYear(month, year) {
  return month === 12 ? year + 1 : year;
}

/**
 * Compute the 12-month anniversary sales window for a hero.
 * @param {string} memorialDateStr — ISO date of hero's passing, e.g. "2020-03-15"
 * @param {number} cycleYear — the year whose cycle is ending, e.g. 2026
 * @returns {{ startAfter: string, endInclusive: string }}
 *   startAfter:   exclusive lower bound (sales must be AFTER this date)
 *   endInclusive: inclusive upper bound (sales through end of this date)
 */
export function getAnniversaryWindow(memorialDateStr, cycleYear) {
  const mmdd = memorialDateStr.slice(5); // "03-15"
  return {
    startAfter: `${cycleYear - 1}-${mmdd}`,
    endInclusive: `${cycleYear}-${mmdd}`,
  };
}
