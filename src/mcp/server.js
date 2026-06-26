import readline from "node:readline";
import { PROTOCOL_VERSION, SERVER_INFO } from "../constants.js";
import { jsonRpcError, rpcError, toRpcError } from "../errors.js";
import { PROMPTS, TOOLS } from "../schemas.js";
import { getPrompt } from "./prompts.js";
import { listResources, readResource } from "./resources.js";
import { callTool } from "./tools.js";

export function serve() {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let request;
    try {
      request = JSON.parse(line);
    } catch (error) {
      writeResponse(null, null, jsonRpcError(-32700, `Parse error: ${error.message}`));
      return;
    }

    if (!request.id && request.method?.startsWith("notifications/")) return;

    try {
      const result = await handleRequest(request);
      if (request.id !== undefined) writeResponse(request.id, result);
    } catch (error) {
      if (request.id !== undefined) writeResponse(request.id, null, toRpcError(error));
    }
  });
}

export async function handleRequest(request) {
  const { method, params = {} } = request;
  switch (method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: SERVER_INFO,
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call":
      return callTool(params.name, params.arguments ?? {});
    case "resources/list":
      return { resources: listResources() };
    case "resources/read":
      return readResource(params.uri);
    case "prompts/list":
      return { prompts: PROMPTS };
    case "prompts/get":
      return getPrompt(params.name, params.arguments ?? {});
    default:
      throw rpcError(-32601, `Method not found: ${method}`);
  }
}

function writeResponse(id, result, error = null) {
  const response = error
    ? { jsonrpc: "2.0", id, error }
    : { jsonrpc: "2.0", id, result };
  process.stdout.write(`${JSON.stringify(response)}\n`);
}
