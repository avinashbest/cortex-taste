import { POLICY_TEXT } from "../constants.js";
import { rpcError } from "../errors.js";
import { EVENT_SCHEMA } from "../schemas.js";
import { readProfile } from "../cortex/profile.js";
import { resourceContents } from "./format.js";

export function listResources() {
  return [
    {
      uri: "cortex://profile/project",
      name: "Project Cortex Profile",
      description: "Project-local compact decision profile.",
      mimeType: "text/markdown",
    },
    {
      uri: "cortex://profile/user",
      name: "User Cortex Profile",
      description: "Optional user-level compact decision profile.",
      mimeType: "text/markdown",
    },
    {
      uri: "cortex://policy",
      name: "Cortex Learning Policy",
      description: "Rules for safe compact profile updates.",
      mimeType: "text/plain",
    },
    {
      uri: "cortex://schema/event",
      name: "Completion Event Schema",
      description: "Schema expected by cortex_assess_completion.",
      mimeType: "application/json",
    },
  ];
}

export function readResource(uri) {
  if (uri === "cortex://profile/project") {
    return resourceContents(uri, "text/markdown", readProfile("project", false).profile);
  }
  if (uri === "cortex://profile/user") {
    return resourceContents(uri, "text/markdown", readProfile("user", false).profile);
  }
  if (uri === "cortex://policy") {
    return resourceContents(uri, "text/plain", POLICY_TEXT);
  }
  if (uri === "cortex://schema/event") {
    return resourceContents(uri, "application/json", JSON.stringify(EVENT_SCHEMA, null, 2));
  }
  throw rpcError(-32602, `Unknown resource URI: ${uri}`);
}
