import volunteers from "@/data/volunteers.json";

/**
 * Build a dynamic email signature based on the sender.
 * Joseph gets full sig with title + phone.
 * Named roles (Volunteer Coordinator, etc.) get their title.
 * Everyone else gets "Steel Hearts Volunteer".
 */
export function buildEmailSignature(senderName, senderEmail) {
  const vol = volunteers.find(
    (v) => v.email.toLowerCase() === senderEmail?.toLowerCase()
  );

  let sig = `\nBest,\n${senderName || "The Steel Hearts Team"}\n`;

  if (vol?.isFounder) {
    sig += `${vol.role}\n`;
    sig += `Steel Hearts 501(c)(3)\n`;
    sig += `www.steel-hearts.org\n`;
    sig += `408.569.8449`;
  } else if (vol && vol.role && vol.role !== "Volunteer") {
    sig += `${vol.role}\n`;
    sig += `Steel Hearts 501(c)(3)\n`;
    sig += `www.steel-hearts.org`;
  } else {
    sig += `Steel Hearts 501(c)(3)\n`;
    sig += `www.steel-hearts.org`;
  }

  return sig;
}
