import volunteerData from "@/data/volunteers.json";

export async function getVolunteers() {
  return volunteerData;
}

export async function getVolunteerByName(name) {
  return volunteerData.find((v) => v.name === name) || null;
}

export async function getVolunteerStats() {
  const total = volunteerData.length;
  const internal = volunteerData.filter((v) => !v.isExternal).length;
  const external = volunteerData.filter((v) => v.isExternal).length;
  return { total, internal, external };
}
