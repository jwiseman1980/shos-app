const STATUS_MAP = {
  sent: "green",
  email_sent: "green",
  complete: "green",
  completed: "green",
  active: "green",
  shipped: "green",
  assigned: "orange",
  scheduled: "orange",
  in_progress: "orange",
  pending: "orange",
  production: "orange",
  escalated: "red",
  blocked: "red",
  overdue: "red",
  past_due: "red",
  not_started: "gray",
  draft: "gray",
  new: "blue",
  upcoming: "blue",
  review: "purple",
  proposal: "purple",
};

export default function StatusBadge({ status, label }) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "_");
  const color = STATUS_MAP[key] || "gray";
  const displayLabel = label || status;

  return (
    <span className={`badge badge-${color}`}>
      {displayLabel}
    </span>
  );
}
