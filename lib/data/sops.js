import sopData from "@/data/sops.json";

export async function getSops() {
  return sopData;
}

export async function getSopById(id) {
  return sopData.find((s) => s.id === id) || null;
}

export async function getSopsByDomain(domain) {
  return sopData.filter((s) => s.domain === domain);
}

export async function getSopsDueToday() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun, 1=Mon
  const dom = today.getDate();
  const month = today.getMonth(); // 0-based

  return sopData.filter((s) => {
    if (s.status !== "active" || s.type !== "procedure") return false;
    if (s.cadence === "Daily") return true;
    if (s.cadence === "Weekly" && dow === 1) return true; // Mondays
    if (s.cadence === "Monthly" && dom <= 5) return true; // First 5 days
    if (s.cadence === "Quarterly" && dom <= 5 && [0, 3, 6, 9].includes(month)) return true;
    return false;
  });
}

export async function getSopStats() {
  const total = sopData.length;
  const domains = [...new Set(sopData.map((s) => s.domain))];
  const dailyCount = sopData.filter((s) => s.cadence === "Daily").length;
  const monthlyCount = sopData.filter((s) => s.cadence === "Monthly").length;

  return { total, domains, dailyCount, monthlyCount };
}
