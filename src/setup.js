import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ensureCortexDir, cortexPaths } from "./cortex/storage.js";

const SUPPORTED_AGENTS = ["claude", "codex", "cursor", "gemini"];

export function setupCommand(argv) {
  const options = parseSetupArgs(argv);
  const server = serverCommand(options.preferGlobal);
  ensureCortexDir(cortexPaths(options.scope));

  const agents = options.agent === "all"
    ? SUPPORTED_AGENTS.filter((agent) => agent === "cursor" || commandExists(agentCommand(agent)))
    : [options.agent];

  const results = agents.map((agent) => configureAgent(agent, options, server));
  printSetupSummary(results, server, options);

  if (results.some((result) => result.status === "failed")) process.exitCode = 1;
}

function parseSetupArgs(argv) {
  const options = {
    agent: "all",
    scope: "user",
    preferGlobal: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--agent") options.agent = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--agent=")) options.agent = arg.split("=", 2)[1];
    else if (arg === "--scope") options.scope = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--scope=")) options.scope = arg.split("=", 2)[1];
    else if (arg === "--prefer-global") options.preferGlobal = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      printSetupHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown setup option: ${arg}`);
    }
  }

  if (![...SUPPORTED_AGENTS, "all"].includes(options.agent)) {
    throw new Error(`Unsupported agent: ${options.agent}`);
  }
  if (!["user", "project"].includes(options.scope)) {
    throw new Error(`Unsupported scope: ${options.scope}`);
  }
  return options;
}

function configureAgent(agent, options, server) {
  if (agent === "claude") return configureWithCommand("claude", claudeArgs(options.scope, server), options);
  if (agent === "codex") return configureWithCommand("codex", codexArgs(server), options);
  if (agent === "gemini") return configureWithCommand("gemini", geminiArgs(options.scope, server), options);
  if (agent === "cursor") return configureCursor(options, server);
  return { agent, status: "failed", message: "Unsupported agent." };
}

function configureWithCommand(agent, args, options) {
  const command = agentCommand(agent);
  if (!commandExists(command)) {
    return { agent, status: "skipped", message: `${command} command not found.` };
  }
  if (options.dryRun) {
    return { agent, status: "dry-run", command: [command, ...args].join(" ") };
  }
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status === 0) {
    return { agent, status: "configured", message: result.stdout.trim() };
  }
  return {
    agent,
    status: "failed",
    message: (result.stderr || result.stdout || `Exit status ${result.status}`).trim(),
  };
}

function configureCursor(options, server) {
  const configPath = options.scope === "project"
    ? path.join(process.cwd(), ".cursor", "mcp.json")
    : path.join(os.homedir(), ".cursor", "mcp.json");
  const nextConfig = mergeMcpConfig(readJson(configPath), "cortex", {
    type: "stdio",
    command: server.command,
    args: server.args,
  });

  if (options.dryRun) {
    return { agent: "cursor", status: "dry-run", path: configPath, config: nextConfig };
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return { agent: "cursor", status: "configured", path: configPath };
}

function claudeArgs(scope, server) {
  return [
    "mcp",
    "add",
    "--transport",
    "stdio",
    "--scope",
    scope,
    "cortex",
    "--",
    server.command,
    ...server.args,
  ];
}

function codexArgs(server) {
  return ["mcp", "add", "cortex", "--", server.command, ...server.args];
}

function geminiArgs(scope, server) {
  return ["mcp", "add", "--scope", scope, "cortex", server.command, ...server.args];
}

function serverCommand(preferGlobal) {
  if (preferGlobal) return { command: "cortex-taste", args: ["serve"] };
  return { command: "npx", args: ["-y", "cortex-taste@latest", "serve"] };
}

function mergeMcpConfig(config, name, server) {
  const next = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  next.mcpServers = next.mcpServers && typeof next.mcpServers === "object" ? next.mcpServers : {};
  next.mcpServers[name] = server;
  return next;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function commandExists(command) {
  const result = spawnSync("which", [command], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function agentCommand(agent) {
  if (agent === "cursor") return "agent";
  return agent;
}

function printSetupSummary(results, server, options) {
  console.log("Cortex Taste setup");
  console.log(`scope=${options.scope} server=${server.command} ${server.args.join(" ")}`);
  for (const result of results) {
    console.log(`${result.agent}: ${result.status}${result.path ? ` (${result.path})` : ""}`);
    if (result.command) console.log(`  ${result.command}`);
    if (result.message) console.log(`  ${result.message}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log("- Restart or reload your agent CLI if it was already running.");
  console.log("- Check the host MCP status command, such as /mcp, claude mcp list, agent mcp list, or gemini mcp list.");
}

function printSetupHelp() {
  console.log(`cortex-taste setup

Usage:
  cortex-taste setup
  cortex-taste setup --agent cursor
  cortex-taste setup --agent all --scope user
  cortex-taste setup --prefer-global

Options:
  --agent <name>      claude, codex, cursor, gemini, or all
  --scope <scope>     user or project
  --prefer-global     Use "cortex-taste serve" in generated MCP configs
  --dry-run           Print intended changes without writing config
`);
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value) throw new Error(`${option} requires a value`);
  return value;
}
