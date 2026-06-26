import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_SETTINGS } from "../constants.js";
import { rpcError } from "../errors.js";

export function cortexPaths(scope) {
  if (scope !== "project" && scope !== "user") {
    throw rpcError(-32602, `Invalid scope: ${scope}`);
  }
  const root = scope === "user" ? path.join(os.homedir(), ".cortex") : path.join(process.cwd(), ".cortex");
  return {
    root,
    profilePath: path.join(root, "cortex-taste.md"),
    metaPath: path.join(root, "cortex-taste.meta.json"),
    settingsPath: path.join(root, "settings.json"),
  };
}

export function ensureCortexDir(paths) {
  fs.mkdirSync(paths.root, { recursive: true });
  if (!fs.existsSync(paths.profilePath)) writeTextAtomic(paths.profilePath, "");
  if (!fs.existsSync(paths.metaPath)) {
    writeJsonAtomic(paths.metaPath, {
      version: 1,
      entries: [],
      rejections: [],
      updated_at: new Date().toISOString(),
    });
  }
  if (!fs.existsSync(paths.settingsPath)) writeJsonAtomic(paths.settingsPath, DEFAULT_SETTINGS);
}

export function readSettings(scope) {
  const paths = cortexPaths(scope);
  const raw = readText(paths.settingsPath);
  if (!raw.trim()) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function readMeta(metaPath) {
  const raw = readText(metaPath);
  if (!raw.trim()) return { version: 1, entries: [], rejections: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { version: 1, entries: [], rejections: [], parse_error_recovered: true };
  }
}

export function updateMeta(metaPath, candidate, compacted) {
  const meta = readMeta(metaPath);
  meta.version = 1;
  meta.updated_at = new Date().toISOString();
  meta.compaction = {
    last_removed: compacted.removed,
    last_compacted: compacted.compacted,
  };
  if (candidate) {
    meta.entries ??= [];
    meta.entries.push({
      id: `ctx_${Date.now()}`,
      line_hash: hashLine(candidate.line),
      category: candidate.category ?? "general",
      confidence: candidate.confidence ?? 0.8,
      evidence_type: candidate.evidence_type ?? "reviewed",
      action: candidate.action ?? "append",
      at: new Date().toISOString(),
    });
    meta.entries = meta.entries.slice(-200);
  }
  writeJsonAtomic(metaPath, trimRejections(meta));
}

export function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

export function writeTextAtomic(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, text, "utf8");
  fs.renameSync(tempPath, filePath);
}

export function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function safeMetaCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return {};
  return {
    line_hash: candidate.line ? hashLine(String(candidate.line)) : undefined,
    category: candidate.category,
    confidence: candidate.confidence,
    evidence_type: candidate.evidence_type,
  };
}

export function trimRejections(meta) {
  if (Array.isArray(meta.rejections)) meta.rejections = meta.rejections.slice(-100);
  return meta;
}

export function hashLine(line) {
  let hash = 5381;
  for (const char of line) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}

export function displayPath(filePath) {
  const cwd = process.cwd();
  return filePath.startsWith(cwd) ? path.relative(cwd, filePath) || "." : filePath;
}
