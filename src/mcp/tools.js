import { rpcError } from "../errors.js";
import {
  assessCompletion,
  commitUpdate,
  compactProfile,
  explainCandidate,
  learnFromCompletion,
  readProfile,
  rejectCandidate,
} from "../cortex/profile.js";
import { toolResult } from "./format.js";

export function callTool(name, args) {
  switch (name) {
    case "cortex_read_profile":
      return toolResult(readProfile(args.scope ?? "project", Boolean(args.include_metadata)));
    case "cortex_assess_completion":
      return toolResult(assessCompletion(args));
    case "cortex_commit_update":
      return toolResult(commitUpdate(args.scope ?? "project", args.candidate));
    case "cortex_learn_from_completion":
      return toolResult(learnFromCompletion(args));
    case "cortex_compact_profile":
      return toolResult(compactProfile(args.scope ?? "project"));
    case "cortex_reject_candidate":
      return toolResult(rejectCandidate(args.scope ?? "project", args.candidate, args.reason));
    case "cortex_explain_candidate":
      return toolResult(explainCandidate(args.candidate));
    default:
      throw rpcError(-32602, `Unknown tool: ${name}`);
  }
}
