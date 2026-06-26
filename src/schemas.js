export const EVENT_SCHEMA = {
  type: "object",
  required: ["task_status"],
  properties: {
    scope: { type: "string", enum: ["project", "user"] },
    agent: { type: "string" },
    task_status: { type: "string", enum: ["completed", "cancelled", "failed"] },
    user_request: { type: "string" },
    observable_signals: { type: "array", items: { type: "string" } },
    agent_actions: { type: "array", items: { type: "string" } },
    existing_profile_excerpt: { type: "string" },
    agent_observed_decision: { type: "string" },
  },
};

export const TOOLS = [
  {
    name: "cortex_read_profile",
    description: "Read the compact Cortex decision profile.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["project", "user"], default: "project" },
        include_metadata: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "cortex_assess_completion",
    description: "Dry-run whether a completed task produced enough direct evidence to update cortex-taste.md.",
    inputSchema: EVENT_SCHEMA,
  },
  {
    name: "cortex_commit_update",
    description: "Atomically apply a reviewed Cortex candidate update.",
    inputSchema: {
      type: "object",
      required: ["candidate"],
      properties: {
        scope: { type: "string", enum: ["project", "user"], default: "project" },
        candidate: {
          type: "object",
          required: ["line"],
          properties: {
            line: { type: "string" },
            category: { type: "string" },
            confidence: { type: "number" },
            evidence_type: { type: "string" },
            action: { type: "string", enum: ["append", "replace"], default: "append" },
            replaces: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
  {
    name: "cortex_learn_from_completion",
    description: "Assess and optionally commit a high-confidence completion update.",
    inputSchema: {
      ...EVENT_SCHEMA,
      properties: {
        ...EVENT_SCHEMA.properties,
        mode: { type: "string", enum: ["dry_run", "auto_commit"], default: "dry_run" },
      },
    },
  },
  {
    name: "cortex_compact_profile",
    description: "Merge duplicates and enforce Cortex profile size limits.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["project", "user"], default: "project" },
      },
    },
  },
  {
    name: "cortex_reject_candidate",
    description: "Record that a proposed learning candidate was invalid without writing it to cortex-taste.md.",
    inputSchema: {
      type: "object",
      required: ["candidate", "reason"],
      properties: {
        scope: { type: "string", enum: ["project", "user"], default: "project" },
        candidate: { type: "object" },
        reason: { type: "string" },
      },
    },
  },
  {
    name: "cortex_explain_candidate",
    description: "Explain whether a candidate is grounded, compact, and safe.",
    inputSchema: {
      type: "object",
      required: ["candidate"],
      properties: {
        candidate: { type: "object" },
      },
    },
  },
];

export const PROMPTS = [
  {
    name: "cortex_task_start",
    description: "Read Cortex before planning or implementation.",
    arguments: [],
  },
  {
    name: "cortex_task_complete",
    description: "Assess whether the completed task produced a grounded Cortex update.",
    arguments: [],
  },
  {
    name: "cortex_candidate_review",
    description: "Review a candidate Cortex learning for compactness and grounding.",
    arguments: [{ name: "candidate", required: true }],
  },
];
