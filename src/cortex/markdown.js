export function profileLines(profile) {
  return profile
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

export function formatProfile(lines) {
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export function normalizeBullet(line) {
  const trimmed = String(line ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.startsWith("- ") ? trimmed : `- ${trimmed.replace(/^[-*]\s*/, "")}`;
}

export function canonicalLine(line) {
  return normalizeBullet(line)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toPreferenceLine(text) {
  const cleaned = String(text).replace(/^user\s+/i, "").replace(/\.$/, "").trim();
  return normalizeBullet(cleaned);
}
