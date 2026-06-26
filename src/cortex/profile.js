import { rpcError } from "../errors.js";
import { candidateFromEvidence, compactLines, rejectedAlternativesFor, validateCandidate } from "./candidates.js";
import { canonicalLine, formatProfile, normalizeBullet, profileLines } from "./markdown.js";
import {
  cortexPaths,
  displayPath,
  ensureCortexDir,
  readMeta,
  readSettings,
  readText,
  safeMetaCandidate,
  trimRejections,
  updateMeta,
  writeJsonAtomic,
  writeTextAtomic,
} from "./storage.js";

export function readProfile(scope, includeMetadata) {
  const paths = cortexPaths(scope);
  ensureCortexDir(paths);
  const profile = readText(paths.profilePath);
  const lines = profileLines(profile);
  const result = {
    profile,
    profile_bytes: Buffer.byteLength(profile, "utf8"),
    entry_count: lines.length,
    scope,
    path: displayPath(paths.profilePath),
  };
  if (includeMetadata) result.metadata = readMeta(paths.metaPath);
  return result;
}

export function assessCompletion(event) {
  const scope = event.scope ?? "project";
  const signals = normalizeStringArray(event.observable_signals);
  const agentActions = normalizeStringArray(event.agent_actions);
  const allEvidence = [...signals, ...agentActions, event.user_request ?? "", event.agent_observed_decision ?? ""]
    .filter(Boolean)
    .join("\n");

  if (event.task_status !== "completed") {
    return {
      decision: "no_update",
      confidence: 0,
      reason: "Task status is not completed.",
      scope,
    };
  }

  const candidate = candidateFromEvidence(allEvidence, event.agent_observed_decision);
  if (!candidate) {
    return {
      decision: "no_update",
      confidence: 0.34,
      reason: "No direct decision-behavior signal found.",
      scope,
    };
  }

  const review = validateCandidate(candidate);
  if (!review.valid) {
    return {
      decision: "no_update",
      confidence: candidate.confidence,
      reason: review.reason,
      rejected_candidate: candidate,
      scope,
    };
  }

  const existing = new Set(profileLines(readText(cortexPaths(scope).profilePath)).map(canonicalLine));
  if (existing.has(canonicalLine(candidate.line))) {
    return {
      decision: "no_update",
      confidence: candidate.confidence,
      reason: "Equivalent Cortex entry already exists.",
      scope,
    };
  }

  return {
    decision: "candidate",
    confidence: candidate.confidence,
    candidate,
    rejected_alternatives: rejectedAlternativesFor(candidate),
    scope,
  };
}

export function learnFromCompletion(event) {
  const assessment = assessCompletion(event);
  const settings = readSettings(event.scope ?? "project");
  const mode = event.mode ?? "dry_run";
  if (assessment.decision !== "candidate") {
    return { status: "skipped", assessment };
  }
  if (mode !== "auto_commit" || !settings.autoCommit) {
    return { status: "dry_run", assessment };
  }
  if (assessment.confidence < settings.confidenceThreshold) {
    return { status: "skipped", reason: "Candidate below confidence threshold.", assessment };
  }
  return {
    status: "updated",
    assessment,
    commit: commitUpdate(event.scope ?? "project", assessment.candidate),
  };
}

export function commitUpdate(scope, candidate) {
  if (!candidate || typeof candidate.line !== "string") {
    throw rpcError(-32602, "candidate.line is required");
  }
  const normalizedCandidate = {
    category: "general",
    confidence: 0.8,
    evidence_type: "reviewed",
    action: "append",
    ...candidate,
    line: normalizeBullet(candidate.line),
  };
  const review = validateCandidate(normalizedCandidate);
  if (!review.valid) throw rpcError(-32602, review.reason);

  const paths = cortexPaths(scope);
  ensureCortexDir(paths);
  const current = profileLines(readText(paths.profilePath));
  const currentCanonical = new Set(current.map(canonicalLine));
  let next = current;

  if (normalizedCandidate.action === "replace" && Array.isArray(normalizedCandidate.replaces)) {
    const replaceSet = new Set(normalizedCandidate.replaces.map(canonicalLine));
    next = next.filter((line) => !replaceSet.has(canonicalLine(line)));
  }

  if (!currentCanonical.has(canonicalLine(normalizedCandidate.line))) {
    next.push(normalizedCandidate.line);
  }

  const compacted = compactLines(next, readSettings(scope));
  writeTextAtomic(paths.profilePath, formatProfile(compacted.lines));
  updateMeta(paths.metaPath, normalizedCandidate, compacted);

  const profile = readText(paths.profilePath);
  return {
    status: currentCanonical.has(canonicalLine(normalizedCandidate.line)) ? "unchanged" : "updated",
    path: displayPath(paths.profilePath),
    entry_count: profileLines(profile).length,
    profile_bytes: Buffer.byteLength(profile, "utf8"),
    compacted: compacted.compacted,
  };
}

export function compactProfile(scope) {
  const paths = cortexPaths(scope);
  ensureCortexDir(paths);
  const compacted = compactLines(profileLines(readText(paths.profilePath)), readSettings(scope));
  writeTextAtomic(paths.profilePath, formatProfile(compacted.lines));
  updateMeta(paths.metaPath, null, compacted);
  const profile = readText(paths.profilePath);
  return {
    status: "compacted",
    path: displayPath(paths.profilePath),
    entry_count: profileLines(profile).length,
    profile_bytes: Buffer.byteLength(profile, "utf8"),
    removed: compacted.removed,
  };
}

export function rejectCandidate(scope, candidate, reason) {
  if (!reason) throw rpcError(-32602, "reason is required");
  const paths = cortexPaths(scope);
  ensureCortexDir(paths);
  const meta = readMeta(paths.metaPath);
  meta.rejections ??= [];
  meta.rejections.push({
    at: new Date().toISOString(),
    candidate: safeMetaCandidate(candidate),
    reason: String(reason).slice(0, 500),
  });
  writeJsonAtomic(paths.metaPath, trimRejections(meta));
  return { status: "rejected_recorded", path: displayPath(paths.metaPath) };
}

export function explainCandidate(candidate) {
  const normalized = {
    confidence: typeof candidate?.confidence === "number" ? candidate.confidence : 0,
    line: normalizeBullet(String(candidate?.line ?? "")),
  };
  const review = validateCandidate(normalized);
  return {
    valid: review.valid,
    reason: review.reason,
    checks: {
      one_line: !normalized.line.includes("\n"),
      bullet: normalized.line.startsWith("- "),
      compact: normalized.line.length <= 160,
      useful_for_future_decision: review.valid,
    },
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}
