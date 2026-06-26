export const VERSION = "0.1.0";
export const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_INFO = { name: "cortex-taste", version: VERSION };

export const DEFAULT_SETTINGS = {
  maxLines: 30,
  maxBytes: 2048,
  confidenceThreshold: 0.8,
  autoCommit: false,
  projectEnabled: true,
  userEnabled: false,
};

export const POLICY_TEXT = [
  "Cortex stores compact user decision behavior only.",
  "Write at most one or two precise lines per completed task.",
  "Skip generic task summaries, implementation details, transcripts, secrets, and unsupported personality claims.",
  "Prefer conditional decision rules over broad likes/dislikes.",
  "Merge, compress, or replace older entries when newer evidence is clearer.",
].join("\n");
