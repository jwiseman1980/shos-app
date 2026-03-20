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
