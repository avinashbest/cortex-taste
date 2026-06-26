# Cortex Taste

Cortex Taste is a local Model Context Protocol server for CLI coding agents. It keeps a compact decision profile in `.cortex/cortex-taste.md` so agents can learn how you make engineering decisions without storing transcripts, long memories, or task logs.

The server is intended for tools such as Claude Code, Codex CLI, Cursor CLI, Gemini CLI, and any other MCP host that can run a local stdio server.

## What Cortex Learns

Cortex stores reusable decision behavior, not project history.

Good Cortex entries:

```md
- Prefer exact user-specified paths over inferred conventional paths.
- Keep agent-learning profiles compact and behavior-oriented; avoid task logs and generic summaries.
- Prefer distinct product vocabulary when adapting prior-art concepts to avoid namespace collision.
```

Bad Cortex entries:

```md
- Created README.md.
- User likes Markdown.
- Fixed the MCP server implementation.
- User is impatient.
```

The profile should answer: "How should an agent make better decisions for this user next time?"

## Features

- Local stdio MCP server with no runtime dependencies beyond Node.js.
- Project profile at `.cortex/cortex-taste.md`.
- Metadata at `.cortex/cortex-taste.meta.json`.
- Compact update policy with max line and byte budgets.
- Dry-run assessment before writes.
- Atomic profile and metadata writes.
- Duplicate prevention and profile compaction.
- MCP resources for profile, policy, and schema.
- MCP tools for reading, assessing, committing, compacting, rejecting, and explaining candidates.
- MCP prompts for task-start and task-completion workflows.

## Requirements

- Node.js 20 or newer.
- An MCP-capable host such as Claude Code, Codex CLI, Cursor CLI, Gemini CLI, or another MCP client.

## Install And Setup

For published releases, the intended zero-friction setup is:

```bash
npx cortex-taste@latest setup
```

That command should detect supported CLI agents, register Cortex as a local stdio MCP server, create Cortex files, and print verification steps.

The generated MCP server command should use:

```bash
npx -y cortex-taste@latest serve
```

This avoids a global install and lets MCP hosts start Cortex on demand.

For faster repeated startup, install globally:

```bash
npm i -g cortex-taste
cortex-taste setup --prefer-global
```

With `--prefer-global`, generated MCP configs should use:

```bash
cortex-taste serve
```

Agent-specific setup commands should be:

```bash
npx cortex-taste@latest setup --agent claude
npx cortex-taste@latest setup --agent codex
npx cortex-taste@latest setup --agent cursor
npx cortex-taste@latest setup --agent gemini
```

Scope-specific setup commands should be:

```bash
npx cortex-taste@latest setup --scope user
npx cortex-taste@latest setup --scope project
```

Current repository note: the local implementation does not yet include the `setup` command, and `package.json` is still private. Until publishing is enabled, use the local development commands below.

Check the local server:

```bash
node bin/cortex-taste.js doctor
npm run check
```

## Run Locally

From this repository:

```bash
node bin/cortex-taste.js serve
```

Useful local commands:

```bash
node bin/cortex-taste.js init generic
node bin/cortex-taste.js inspect
node bin/cortex-taste.js compact
node bin/cortex-taste.js doctor
```

If installed as a package, use:

```bash
cortex-taste serve
cortex-taste inspect
cortex-taste compact
cortex-taste doctor
```

## MCP Surface

Resources:

- `cortex://profile/project` reads project-local `.cortex/cortex-taste.md`.
- `cortex://profile/user` reads optional user-level `~/.cortex/cortex-taste.md`.
- `cortex://policy` describes the compact learning rules.
- `cortex://schema/event` exposes the completion-event schema.

Tools:

- `cortex_read_profile`: read the compact decision profile.
- `cortex_assess_completion`: dry-run whether a completed task has enough direct evidence for a Cortex update.
- `cortex_commit_update`: atomically write a reviewed candidate to `cortex-taste.md`.
- `cortex_learn_from_completion`: assess and optionally auto-commit when settings allow it.
- `cortex_compact_profile`: merge duplicates and enforce size limits.
- `cortex_reject_candidate`: record that a candidate was invalid without writing it to `cortex-taste.md`.
- `cortex_explain_candidate`: explain why a candidate is valid or invalid.

Prompts:

- `cortex_task_start`
- `cortex_task_complete`
- `cortex_candidate_review`

## Agent Workflow

At task start, the agent should read `cortex://profile/project` and use only relevant entries.

At task completion, the agent should call `cortex_assess_completion` with direct observable signals, such as:

- explicit user corrections
- approvals or rejections
- requested direction changes
- accepted tradeoffs
- repeated edit patterns
- how the user delegates or takes responsibility

If the assessment returns a high-confidence candidate, the agent can call `cortex_commit_update`. If evidence is weak, the agent should skip the update.

Agents should not write:

- transcripts
- implementation summaries
- secrets or tokens
- stack traces
- private code details
- unsupported personality claims
- generic preferences
- task logs

## Claude Code Integration

Claude Code supports local stdio MCP servers with:

```bash
claude mcp add [options] <name> -- <command> [args...]
```

Add Cortex for the current project:

```bash
claude mcp add --transport stdio --scope project cortex -- node /absolute/path/to/cortex/bin/cortex-taste.js serve
```

Or add it for your user account:

```bash
claude mcp add --transport stdio --scope user cortex -- node /absolute/path/to/cortex/bin/cortex-taste.js serve
```

Verify:

```bash
claude mcp list
```

Inside Claude Code:

```text
/mcp
```

Project-scoped Claude Code servers are written to `.mcp.json`; user-scoped servers are stored in `~/.claude.json`. Claude Code also supports referencing MCP resources with `@server:protocol://resource/path`, for example:

```text
Read @cortex:cortex://profile/project before planning this change.
```

References:

- Claude Code MCP docs: https://code.claude.com/docs/en/mcp

## Codex CLI Integration

Codex supports stdio MCP servers and stores configuration in `config.toml`. User config is normally `~/.codex/config.toml`; project config can be `.codex/config.toml` in trusted projects.

Add Cortex with the Codex CLI:

```bash
codex mcp add cortex -- node /absolute/path/to/cortex/bin/cortex-taste.js serve
```

Or edit `~/.codex/config.toml` or `.codex/config.toml`:

```toml
[mcp_servers.cortex]
command = "node"
args = ["/absolute/path/to/cortex/bin/cortex-taste.js", "serve"]
startup_timeout_sec = 10
tool_timeout_sec = 30
enabled = true
```

In the Codex TUI, verify:

```text
/mcp
```

Recommended Codex instruction:

```text
At task start, read cortex://profile/project. At task completion, call cortex_assess_completion with direct user corrections, approvals, rejections, and direction changes. Commit only high-confidence compact Cortex updates.
```

References:

- Codex MCP docs: https://developers.openai.com/codex/mcp
- Codex config docs: https://developers.openai.com/codex/config-basic

## Cursor CLI And Cursor Editor Integration

Cursor uses `mcp.json` for custom MCP servers. Project config goes in `.cursor/mcp.json`; global config goes in `~/.cursor/mcp.json`. Cursor CLI uses the same MCP configuration as the editor.

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cortex": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/cortex/bin/cortex-taste.js", "serve"]
    }
  }
}
```

Useful Cursor CLI commands:

```bash
agent mcp list
agent mcp list-tools cortex
agent mcp enable cortex
agent mcp disable cortex
```

Use Cursor Agent normally:

```bash
agent -p "Use Cortex to read my decision profile before planning this change."
```

Cursor automatically discovers and uses MCP tools when relevant. It asks for approval before MCP tool use by default.

References:

- Cursor MCP docs: https://cursor.com/docs/mcp.md
- Cursor CLI MCP docs: https://cursor.com/docs/cli/mcp.md

## Gemini CLI Integration

Gemini CLI supports MCP servers through `settings.json` and the `gemini mcp` commands. Stdio is the default transport for local servers.

Add Cortex:

```bash
gemini mcp add cortex node /absolute/path/to/cortex/bin/cortex-taste.js serve
```

Add Cortex at user scope:

```bash
gemini mcp add --scope user cortex node /absolute/path/to/cortex/bin/cortex-taste.js serve
```

Or configure manually in `.gemini/settings.json` or `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "cortex": {
      "command": "node",
      "args": ["/absolute/path/to/cortex/bin/cortex-taste.js", "serve"],
      "timeout": 30000,
      "trust": false
    }
  }
}
```

Verify:

```bash
gemini mcp list
```

Inside Gemini CLI, use `/mcp` frequently during setup to monitor server status. Gemini CLI can expose MCP prompts as slash commands when the host discovers server prompts.

References:

- Gemini CLI MCP docs: https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html

## Generic MCP Configuration

Most stdio MCP hosts accept this shape:

```json
{
  "mcpServers": {
    "cortex": {
      "command": "node",
      "args": ["/absolute/path/to/cortex/bin/cortex-taste.js", "serve"]
    }
  }
}
```

You can print a local config template with:

```bash
node bin/cortex-taste.js init generic
```

## Example End-To-End Flow

1. Agent starts a task.
2. Agent reads `cortex://profile/project`.
3. Agent uses relevant decision rules while planning and editing.
4. User corrects direction, approves a tradeoff, or rejects part of the work.
5. Task completes.
6. Agent calls `cortex_assess_completion`.
7. Cortex returns either `no_update` or a compact candidate.
8. Agent commits only a grounded, high-confidence candidate with `cortex_commit_update`.
9. `.cortex/cortex-taste.md` remains compact and useful for the next task.

Example candidate:

```md
- Prefer exact user-specified paths over inferred conventional paths.
```

Rejected alternative:

```md
- User likes files.
```

Reason: too broad and not useful for future coding-agent decisions.

## Settings

Project settings live in `.cortex/settings.json`:

```json
{
  "maxLines": 30,
  "maxBytes": 2048,
  "confidenceThreshold": 0.8,
  "autoCommit": false,
  "projectEnabled": true,
  "userEnabled": false
}
```

`autoCommit` is disabled by default. With the default settings, `cortex_learn_from_completion` returns a dry-run assessment unless you explicitly enable automatic commits.

## Troubleshooting

Check server health:

```bash
node bin/cortex-taste.js doctor
```

Inspect the current profile:

```bash
node bin/cortex-taste.js inspect
```

Compact the profile:

```bash
node bin/cortex-taste.js compact
```

Run syntax checks:

```bash
npm run check
```

If a host cannot start the server:

- Use an absolute path to `bin/cortex-taste.js`.
- Confirm `node --version` is 20 or newer.
- Confirm the MCP host can access this workspace path.
- Check the host MCP status UI or command: `/mcp`, `claude mcp list`, `codex /mcp`, `agent mcp list`, or `gemini mcp list`.

## Security And Privacy

Cortex is local-first. The current implementation reads and writes only local `.cortex` files unless you configure the host or environment otherwise.

Review MCP server code before connecting it to sensitive projects. MCP hosts execute local stdio server commands, and hosts may allow tools to read resources or write files depending on their own security model.

Never store secrets, tokens, credentials, private stack traces, or source code snippets in `cortex-taste.md`.
