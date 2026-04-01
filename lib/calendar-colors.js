// Shared calendar color constants — single source of truth.
// Maps Google Calendar colorId to functional categories.
// Used by CalendarWidget, DayPanel, WeekCalendar, and any future components.

export const COLOR_ID_MAP = {
  "11": { name: "Tomato",    hex: "#D50000", label: "Urgent" },
  "6":  { name: "Tangerine", hex: "#F4511E", label: "Ops" },
  "5":  { name: "Banana",    hex: "#F6BF26", label: "Finance" },
  "10": { name: "Basil",     hex: "#0B8043", label: "Family" },
  "9":  { name: "Blueberry", hex: "#3F51B5", label: "Partnerships" },
  "3":  { name: "Grape",     hex: "#8E24AA", label: "Governance" },
  "7":  { name: "Peacock",   hex: "#039BE5", label: "Prof Dev" },
  "4":  { name: "Flamingo",  hex: "#E67C73", label: "Personal" },
  "8":  { name: "Graphite",  hex: "#616161", label: "Anchor" },
  "2":  { name: "Sage",      hex: "#33B679", label: "Completed" },
  "1":  { name: "Lavender",  hex: "#7986CB", label: "General" },
};

const CALENDAR_ROLE_COLORS = {
  primary: "#3498db",
  ops: "#e74c3c",
};

/**
 * Get the display color for a calendar event.
 * Prefers colorId (functional category), falls back to calendar role color.
 */
export function getEventColor(event) {
  if (event?.colorId && COLOR_ID_MAP[event.colorId]) {
    return COLOR_ID_MAP[event.colorId].hex;
  }
  return CALENDAR_ROLE_COLORS[event?.role] || "#3498db";
}

/**
 * Get the functional label for a calendar event.
 * Prefers colorId label, falls back to calendar role.
 */
export function getEventLabel(event) {
  if (event?.colorId && COLOR_ID_MAP[event.colorId]) {
    return COLOR_ID_MAP[event.colorId].label;
  }
  return event?.role === "ops" ? "Ops" : "Tasks";
}
