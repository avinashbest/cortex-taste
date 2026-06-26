# Cortex Taste Server Design Proposal

## Summary

Cortex Taste is an agent-neutral Model Context Protocol server that exposes compact decision-learning behavior to CLI coding agents such as Claude Code, Codex CLI, Gemini CLI, and other MCP-capable tools.

The server maintains `cortex-taste.md`: a small, distilled decision profile describing how the user makes engineering decisions, accepts or rejects work, revises direction, and expresses implicit preferences. It is not a transcript, memory log, task summary, or implementation journal.

This design uses **Cortex** terminology for the new product to avoid collision with Command Code's existing **Taste** terminology. Command Code's source context says its Taste system learns from accepts, rejects, edits, and micro-decisions, and stores project-specific taste under `.commandcode/taste/`. [Source: `.codex/memory/memory.md`]

## Product Concept

Cortex should run quietly inside the agent workflow, similar to code-indexing or graph-based MCP servers. The user should not need to invoke a separate CLI during normal coding. The agent reads Cortex context at task start, works normally, then asks Cortex whether the completed interaction produced a high-confidence decision-learning update.

The core promise:

- Agents adapt to the user's judgment style across tools.
- Learning is based on direct user signals, not broad personality inference.
- `cortex-taste.md` stays compact enough to load into agent context every session.
- Older entries are merged, compressed, or replaced when newer evidence is clearer.

Recommended implementation language: Rust for the runtime server, with an npm wrapper for familiar installation. Rust gives single-binary distribution, low startup overhead, strong file I/O primitives, and predictable CLI behavior. Go is the pragmatic second choice; TypeScript is reasonable for MVP speed but less ideal for low-overhead CLI runtime.

## Terminology

Use these terms in product, APIs, docs, and filenames:

- Product: `Cortex`
- MCP package: `cortex-taste`
- Profile file: `cortex-taste.md`
- Metadata file: `cortex-taste.meta.json`
- Resource prefix: `cortex://`
- CLI binary: `cortex-taste`

Use the word "Taste" only when discussing Command Code's existing feature or quoted/source-cited prior art.

## Storage Model

Default project files:

```text
.cortex/
  cortex-taste.md
  cortex-taste.meta.json
  settings.json
```

Optional user-level files:

```text
~/.cortex/
  cortex-taste.md
  cortex-taste.meta.json
  settings.json
```

`cortex-taste.md` is the only profile intended to be read by agents. It must remain human-editable Markdown.

`cortex-taste.meta.json` stores operational metadata only:

- stable entry IDs
- confidence scores
- timestamps
- replacement history
- evidence counters
- source agent name
- compaction version

It must not store full transcripts, code snippets, stack traces, secrets, private repository details, or verbose task history.

## MCP Architecture

Cortex Taste should expose resources for context, tools for learning, and prompts for host-agent workflow guidance. MCP servers can expose tools, resources, and prompts to clients; tools are model-controlled function calls, while resources provide context. [Source: MCP specification checked during planning]

Resources:

- `cortex://profile/project` returns the current project `cortex-taste.md`.
- `cortex://profile/user` returns the current user-level profile if enabled.
- `cortex://policy` returns update rules, size budget, confidence threshold, and banned content categories.
- `cortex://schema/event` returns the expected completion-event schema.

Tools:

- `cortex_read_profile`
- `cortex_assess_completion`
- `cortex_commit_update`
- `cortex_learn_from_completion`
- `cortex_compact_profile`
- `cortex_reject_candidate`
- `cortex_explain_candidate`

Prompt templates:

- `cortex_task_start`: instructs the agent to read project Cortex context before planning or implementing.
- `cortex_task_complete`: instructs the agent to assess decision-learning evidence after a completed task.
- `cortex_candidate_review`: helps the agent decide whether a candidate is grounded, compact, and non-generic.

## Tool Design

### `cortex_read_profile`

Purpose: load current decision profile.

Input:

```json
{
  "scope": "project",
  "include_metadata": false
}
```

Output:

```json
{
  "profile": "- Prefer exact user-specified paths over inferred defaults when updating project files.",
  "profile_bytes": 91,
  "entry_count": 1,
  "scope": "project"
}
```

### `cortex_assess_completion`

Purpose: dry-run whether the latest completed task contains enough direct evidence to update `cortex-taste.md`.

Input:

```json
{
  "scope": "project",
  "agent": "codex-cli",
  "task_status": "completed",
  "user_request": "Implement the plan.",
  "observable_signals": [
    "User corrected terminology from the prior name to Cortex.",
    "User asked to persist the plan into .codex/plan/*.md.",
    "User updated permissions after a filesystem denial."
  ],
  "agent_actions": [
    "Created the requested plan file after permission changed."
  ],
  "existing_profile_excerpt": ""
}
```

Output:

```json
{
  "decision": "candidate",
  "confidence": 0.82,
  "candidate": {
    "line": "- Prefer product vocabulary to avoid namespace collision with prior art, even when adapting an existing concept.",
    "category": "naming_judgment",
    "evidence_type": "explicit_correction",
    "action": "append"
  },
  "rejected_alternatives": [
    {
      "line": "- User likes the word Cortex.",
      "reason": "Overgeneralized beyond the observed naming decision."
    }
  ]
}
```

### `cortex_commit_update`

Purpose: atomically apply a specific assessed update.

Input:

```json
{
  "scope": "project",
  "candidate": {
    "line": "- Prefer product vocabulary to avoid namespace collision with prior art, even when adapting an existing concept.",
    "category": "naming_judgment",
    "confidence": 0.82,
    "evidence_type": "explicit_correction",
    "action": "append"
  }
}
```

Output:

```json
{
  "status": "updated",
  "path": ".cortex/cortex-taste.md",
  "entry_count": 12,
  "profile_bytes": 1380,
  "compacted": false
}
```

### `cortex_learn_from_completion`

Purpose: assess and commit in one call when the host agent policy allows automatic high-confidence writes.

Rules:

- Default to dry-run mode unless automatic writes are explicitly enabled.
- Auto-commit only when confidence is above the configured threshold.
- Return `skipped` when evidence is weak, generic, or task-only.

### `cortex_compact_profile`

Purpose: enforce compactness and merge overlapping entries.

Compaction actions:

- merge duplicate rules
- replace weaker older entries with clearer newer entries
- remove stale low-confidence entries
- shorten wording without changing meaning
- enforce byte and line limits

### `cortex_reject_candidate`

Purpose: let an agent or user reject an invalid learning candidate.

This improves future scoring without writing the rejected claim into `cortex-taste.md`.

### `cortex_explain_candidate`

Purpose: explain why a candidate is or is not valid.

Use this for debuggability and trust, not for normal task flow.

## Agent Workflow

### Task Start

The host agent should:

1. Read `cortex://profile/project`.
2. Optionally read `cortex://profile/user`.
3. Apply relevant decision-profile entries to planning and execution.
4. Avoid exposing Cortex details to the user unless they are relevant.

Example:

```text
Agent starts task -> reads cortex://profile/project -> sees:
- Prefer exact user-specified paths over inferred conventional defaults.
Agent targets the exact requested file path instead of inventing a nearby filename.
```

### During Task

The agent should collect only small evidence notes internally:

- user corrections
- explicit approvals or rejections
- requested reversals
- accepted tradeoffs
- repeated edits that indicate judgment
- responsibility-taking style, such as whether the user wants the agent to decide or ask

The agent should not send full conversation history to Cortex.

### Task Completion

After a completed task, the agent should call `cortex_assess_completion`.

If the result is:

- `no_update`: do nothing.
- `candidate` with high confidence: call `cortex_commit_update`.
- `candidate` with medium confidence: skip by default or ask the user if host policy allows.
- `needs_user_review`: ask a direct question only if the learning would materially affect future work.

Completion should run once per completed task, not after every message.

## What To Write

Good Cortex entries are compact behavioral rules:

```md
- Prefer exact user-specified file paths over inferred conventional paths.
- When naming a productized adaptation of prior art, avoid reusing the prior product's domain term.
- For local project notes, persist decisions into repo-visible Markdown files rather than leaving them only in chat.
```

Each entry should be:

- one line
- directly supported by observed behavior
- useful for future agent decisions
- specific enough to avoid stereotype or personality inference
- broad enough to apply beyond one exact task

## What Not To Write

Do not write task summaries:

```md
- Created .codex/plan/cortex-taste-server-design.md.
```

Do not write implementation details:

```md
- Used apply_patch to add the plan file.
```

Do not write vague preferences:

```md
- User likes Markdown.
```

Do not write sensitive or identity claims:

```md
- User is impatient with permission failures.
```

Do not write broad absolutes from one event:

```md
- Always ask before naming anything.
```

## Update Strategy

Cortex should treat every proposed entry as a claim requiring evidence.

Candidate fields:

```json
{
  "id": "ctx_2026_06_26_001",
  "line": "- Prefer exact user-specified file paths over inferred conventional paths.",
  "category": "execution_preference",
  "confidence": 0.88,
  "evidence_type": "explicit_correction",
  "scope": "project",
  "action": "replace",
  "replaces": ["ctx_2026_06_23_002"]
}
```

Evidence hierarchy:

1. Explicit instruction or correction.
2. Rejection of prior agent behavior.
3. Accepted tradeoff after alternatives were presented.
4. Repeated edit pattern across tasks.
5. Weak implicit signal.

Only the first four should usually write to `cortex-taste.md`. Weak implicit signals should require repetition or user confirmation.

Replacement rules:

- Newer clearer entry replaces older vaguer entry.
- Specific conditional wording beats broad unconditional wording.
- Repeated similar entries merge into one rule.
- Conflicting evidence lowers confidence and may produce no update.

Size policy:

- Default maximum: 30 lines or 2 KB.
- One task can add at most two lines.
- Compaction runs before write if the budget would be exceeded.
- Low-confidence entries are removed before high-confidence entries.

## Safeguards

Cortex must prevent noisy or unsafe profile growth.

Hard bans:

- raw transcripts
- code snippets
- stack traces
- secrets or credentials
- private implementation details
- generic task summaries
- unsupported personality claims
- sensitive personal attributes
- medical, legal, financial, or demographic inferences

Grounding rules:

- Every update must cite an evidence type internally.
- The written `cortex-taste.md` line should not include the evidence itself.
- The metadata can store evidence counters, but not raw conversation text.
- The server should prefer no update over a weak update.

Overgeneralization checks:

- Reject claims containing `always` or `never` unless repeated evidence exists.
- Reject claims about what the user "likes" unless the user explicitly said so.
- Convert broad claims into conditional rules.
- Reject entries that cannot guide a future coding-agent decision.

## Cross-Agent Integration

Ship host-specific setup snippets through:

```bash
cortex-taste init claude
cortex-taste init codex
cortex-taste init gemini
cortex-taste init generic
```

Each setup should install the same behavioral contract:

```text
At task start, read Cortex profile resources.
At task completion, call cortex_assess_completion.
Commit only high-confidence compact updates.
Never store transcripts or task summaries.
```

The server should not depend on a specific agent. Agents differ in hooks and instruction formats, but the MCP interface remains stable.

For hosts without completion hooks, provide a prompt/instruction block telling the agent to call `cortex_assess_completion` before final response when the task is complete.

## CLI Commands

```bash
cortex-taste serve
cortex-taste init codex
cortex-taste init claude
cortex-taste init gemini
cortex-taste inspect
cortex-taste compact
cortex-taste doctor
```

Command behavior:

- `serve`: starts stdio MCP server.
- `init`: prints or writes host configuration.
- `inspect`: displays current `cortex-taste.md`.
- `compact`: rewrites the profile under the configured budget.
- `doctor`: validates file paths, permissions, MCP compatibility, and schema versions.

## Example Flow

1. User asks agent to create a plan file under `.codex/plan/*.md`.
2. Agent only proposes a plan in chat.
3. User says they cannot see it in the working directory.
4. Later, user asks to implement the plan.
5. Cortex candidate:

```md
- For requested local artifacts, persist the file in the workspace instead of leaving the result only in chat.
```

6. Candidate is valid because it comes from an explicit correction and affects future execution behavior.

Invalid candidate from the same interaction:

```md
- User dislikes planning.
```

Reason: unsupported; the user wanted the plan implemented and visible, not avoidance of planning.

## How Cortex Differs From Normal Memory

Normal memory often stores facts, summaries, preferences, or conversation history. Cortex stores only compact decision behavior that changes how an agent should act.

Memory answer:

```md
- The user is designing an MCP server for CLI coding agents.
```

Cortex answer:

```md
- Keep agent-learning profiles compact and behavior-oriented; avoid task logs and generic summaries.
```

The first is project context. The second is reusable judgment.

## Test Plan

Unit tests:

- Extract a valid candidate from explicit correction.
- Skip updates for generic task completion.
- Reject task summaries and implementation details.
- Reject unsupported broad preferences.
- Merge duplicate profile entries.
- Replace weaker old entries with clearer new entries.
- Enforce max line and byte budgets.

Integration tests:

- Start stdio MCP server and list tools/resources/prompts.
- Read empty and populated `cortex-taste.md`.
- Assess completion in dry-run mode without file writes.
- Commit update with atomic write.
- Compact profile deterministically.
- Validate behavior with Claude Code, Codex CLI, Gemini CLI, and generic MCP host configuration.

Performance tests:

- Measure cold server startup.
- Measure profile read latency for 0, 10, 30, and 100 entries.
- Measure completion assessment without network calls.
- Verify normal task-start profile read is below user-visible latency thresholds.

## Open Implementation Decisions

- Whether automatic commits are enabled by default or require host-level opt-in.
- Whether user-level Cortex should merge into project Cortex or remain a separate resource.
- Whether the first release ships Rust-only or TypeScript MVP plus Rust production rewrite.
- Whether `cortex-taste.md` should use plain bullets only or lightweight sections by category.

Recommended defaults:

- Automatic commits disabled for medium-confidence candidates.
- Project Cortex enabled by default; user Cortex opt-in.
- Rust production implementation with npm wrapper.
- Plain bullets only, no sections, to preserve compactness.
