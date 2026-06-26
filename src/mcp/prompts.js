import { rpcError } from "../errors.js";
import { prompt } from "./format.js";

export function getPrompt(name, args) {
  if (name === "cortex_task_start") {
    return prompt("Cortex Task Start", [
      "Read cortex://profile/project before planning.",
      "Apply only relevant decision-profile entries.",
      "Do not expose Cortex details unless relevant to the user request.",
    ].join("\n"));
  }
  if (name === "cortex_task_complete") {
    return prompt("Cortex Task Complete", [
      "After a completed task, call cortex_assess_completion with direct observable signals.",
      "Commit only high-confidence, compact behavior rules.",
      "Skip generic task summaries, implementation details, and unsupported claims.",
    ].join("\n"));
  }
  if (name === "cortex_candidate_review") {
    return prompt("Cortex Candidate Review", [
      `Candidate: ${args.candidate ?? ""}`,
      "Accept only if this is directly supported, one line, behavior-oriented, and useful for future coding-agent decisions.",
    ].join("\n"));
  }
  throw rpcError(-32602, `Unknown prompt: ${name}`);
}
