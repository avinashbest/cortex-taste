import fs from "node:fs";
import path from "node:path";
import { VERSION } from "./constants.js";
import { compactProfile, readProfile } from "./cortex/profile.js";
import { cortexPaths, displayPath, ensureCortexDir } from "./cortex/storage.js";
import { listResources } from "./mcp/resources.js";
import { serve } from "./mcp/server.js";
import { TOOLS } from "./schemas.js";

export function main(argv) {
  const [command = "serve", ...args] = argv;
  if (command === "serve") return serve();
  if (command === "init") return initCommand(args[0] ?? "generic");
  if (command === "inspect") return inspectCommand(args[0] ?? "project");
  if (command === "compact") return compactCommand(args[0] ?? "project");
  if (command === "doctor") return doctorCommand();
  if (command === "--version" || command === "-v") return console.log(VERSION);
  if (command === "--help" || command === "-h") return helpCommand();

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

function initCommand(host) {
  const command = "node";
  const args = [path.join(process.cwd(), "bin", "cortex-taste.js"), "serve"];
  const config = {
    mcpServers: {
      cortex: {
        command,
        args,
      },
    },
  };
  console.log(`# Cortex Taste ${host} configuration`);
  console.log(JSON.stringify(config, null, 2));
  console.log("");
  console.log("Agent instruction:");
  console.log("- Read cortex://profile/project at task start.");
  console.log("- Call cortex_assess_completion after completed tasks.");
  console.log("- Commit only high-confidence compact updates.");
}

function inspectCommand(scope) {
  const result = readProfile(scope, true);
  console.log(`# Cortex profile (${scope})`);
  console.log("");
  console.log(result.profile || "(empty)");
  console.log(`entries=${result.entry_count} bytes=${result.profile_bytes} path=${result.path}`);
}

function compactCommand(scope) {
  console.log(JSON.stringify(compactProfile(scope), null, 2));
}

function doctorCommand() {
  const paths = cortexPaths("project");
  ensureCortexDir(paths);
  const checks = {
    node: process.version,
    cwd: process.cwd(),
    profile: displayPath(paths.profilePath),
    profile_exists: fs.existsSync(paths.profilePath),
    meta_exists: fs.existsSync(paths.metaPath),
    settings_exists: fs.existsSync(paths.settingsPath),
    tools: TOOLS.map((tool) => tool.name),
    resources: listResources().map((resource) => resource.uri),
  };
  console.log(JSON.stringify(checks, null, 2));
}

function helpCommand() {
  console.log(`cortex-taste ${VERSION}

Usage:
  cortex-taste serve              Start stdio MCP server
  cortex-taste init [host]        Print MCP host configuration
  cortex-taste inspect [scope]    Show cortex-taste.md
  cortex-taste compact [scope]    Compact cortex-taste.md
  cortex-taste doctor             Validate local files and server metadata
`);
}
