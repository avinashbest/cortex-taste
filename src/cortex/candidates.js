import { canonicalLine, formatProfile, normalizeBullet, toPreferenceLine } from "./markdown.js";

export function candidateFromEvidence(evidence, observedDecision) {
  const explicit = /(correct|correction|reject|rejected|prefer|instead|should|must|asked|requested|rename|change)/i.test(evidence);
  if (!explicit) return null;

  if (/(terminology|vocabulary|term|rename|naming|collision|already used|namespace)/i.test(evidence)) {
    return candidate(
      "- Prefer distinct product vocabulary when adapting prior-art concepts to avoid namespace collision.",
      "naming_judgment",
      "explicit_correction",
      0.86,
    );
  }
  if (/(path|file|directory|working directory|can't see|cannot see|persist|write|visible|markdown)/i.test(evidence)) {
    return candidate(
      "- For requested local artifacts, persist the file at the exact workspace path instead of leaving the result only in chat.",
      "execution_preference",
      "explicit_correction",
      0.88,
    );
  }
  if (/(permission|operation not permitted|denied|approval|retry)/i.test(evidence)) {
    return candidate(
      "- When local writes are blocked, state the exact filesystem blocker and retry only after the user changes permissions.",
      "execution_preference",
      "explicit_correction",
      0.82,
    );
  }
  if (/(compact|small|token|verbose|summary|transcript|memory log)/i.test(evidence)) {
    return candidate(
      "- Keep agent-learning profiles compact and behavior-oriented; avoid task logs and generic summaries.",
      "profile_quality",
      "explicit_instruction",
      0.84,
    );
  }
  if (observedDecision && observedDecision.length > 12) {
    return candidate(toPreferenceLine(observedDecision), "general", "agent_observed_decision", 0.72);
  }
  return null;
}

export function candidate(line, category, evidenceType, confidence) {
  return {
    line,
    category,
    evidence_type: evidenceType,
    confidence,
    action: "append",
  };
}

export function validateCandidate(candidate) {
  const line = String(candidate?.line ?? "");
  if (!line.trim()) return { valid: false, reason: "Candidate line is empty." };
  if (line.includes("\n")) return { valid: false, reason: "Candidate must be a single line." };
  if (line.length > 180) return { valid: false, reason: "Candidate is too long for cortex-taste.md." };
  if (!line.startsWith("- ")) return { valid: false, reason: "Candidate must be a Markdown bullet." };
  if (/(created|implemented|updated|fixed|ran|used apply_patch|stack trace|password|secret|token|api key)/i.test(line)) {
    return { valid: false, reason: "Candidate looks like a task summary, implementation detail, or sensitive content." };
  }
  if (/\b(always|never)\b/i.test(line) && Number(candidate.confidence ?? 0) < 0.95) {
    return { valid: false, reason: "Absolute claims require repeated high-confidence evidence." };
  }
  if (/\b(user likes|user dislikes|impatient|personality|identity)\b/i.test(line)) {
    return { valid: false, reason: "Candidate is overgeneralized or personality-oriented." };
  }
  return { valid: true, reason: "Candidate is compact, grounded, and behavior-oriented." };
}

export function rejectedAlternativesFor(candidate) {
  if (candidate.category === "naming_judgment") {
    return [{ line: "- User likes the word Cortex.", reason: "Overgeneralized beyond the observed naming decision." }];
  }
  if (candidate.category === "execution_preference") {
    return [{ line: "- User wants every response written to a file.", reason: "Unsupported broad claim from a specific artifact request." }];
  }
  return [{ line: "- User has a general preference.", reason: "Too vague to guide future coding-agent behavior." }];
}

export function compactLines(lines, settings) {
  const byCanonical = new Map();
  for (const raw of lines) {
    const line = normalizeBullet(raw);
    const review = validateCandidate({ line, confidence: 1 });
    if (!review.valid) continue;
    byCanonical.set(canonicalLine(line), line);
  }

  let next = [...byCanonical.values()].sort((a, b) => a.localeCompare(b));
  const originalCount = lines.length;
  let removed = originalCount - next.length;

  while (next.length > settings.maxLines) {
    next.shift();
    removed += 1;
  }

  while (Buffer.byteLength(formatProfile(next), "utf8") > settings.maxBytes && next.length > 0) {
    next.shift();
    removed += 1;
  }

  return {
    lines: next,
    removed,
    compacted: removed > 0,
  };
}
