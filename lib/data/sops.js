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

export async function getSopStats() {
  const total = sopData.length;
  const domains = [...new Set(sopData.map((s) => s.domain))];
  const dailyCount = sopData.filter((s) => s.cadence === "Daily").length;
  const monthlyCount = sopData.filter((s) => s.cadence === "Monthly").length;

  return { total, domains, dailyCount, monthlyCount };
}
