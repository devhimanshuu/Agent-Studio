import { McpToolDefinition, McpToolChange, McpToolChangeKind } from "@/types/mcp";

/**
 * Compare two sets of MCP tool definitions and produce a list of changes.
 * Pure function — no I/O, no side effects.
 */
export function computeToolDiff(
  oldTools: McpToolDefinition[],
  newTools: McpToolDefinition[]
): McpToolChange[] {
  const changes: McpToolChange[] = [];

  const oldByName = new Map(oldTools.map((t) => [t.name, t]));
  const newByName = new Map(newTools.map((t) => [t.name, t]));

  // Detect added and schema_changed tools
  for (const [name, newDef] of newByName) {
    const oldDef = oldByName.get(name);
    if (!oldDef) {
      // Brand new tool
      changes.push({
        toolName: name,
        kind: "added",
        oldDef: null,
        newDef,
        summary: buildAddedSummary(newDef),
      });
    } else {
      // Tool exists in both — check for changes
      const toolChanges = detectToolChanges(oldDef, newDef);
      if (toolChanges.length > 0) {
        changes.push({
          toolName: name,
          kind: toolChanges[0].kind,
          oldDef,
          newDef,
          summary: toolChanges.map((c) => c.summary).join("; "),
        });
      }
    }
  }

  // Detect removed tools
  for (const [name, oldDef] of oldByName) {
    if (!newByName.has(name)) {
      changes.push({
        toolName: name,
        kind: "removed",
        oldDef,
        newDef: null,
        summary: `Tool "${name}" was removed from the upstream server.`,
      });
    }
  }

  return changes;
}

/**
 * Detect specific changes between two tool definitions.
 * Returns an array of change descriptors (may be empty if no changes).
 */
function detectToolChanges(
  oldDef: McpToolDefinition,
  newDef: McpToolDefinition
): Array<{ kind: McpToolChangeKind; summary: string }> {
  const changes: Array<{ kind: McpToolChangeKind; summary: string }> = [];

  // Check inputSchema changes
  const schemaDiff = diffInputSchemas(oldDef.inputSchema, newDef.inputSchema);
  if (schemaDiff.length > 0) {
    changes.push({
      kind: "schema_changed",
      summary: `Input schema: ${schemaDiff.join(", ")}`,
    });
  }

  // Check description changes
  if ((oldDef.description ?? "") !== (newDef.description ?? "")) {
    changes.push({
      kind: "description_changed",
      summary: `Description updated`,
    });
  }

  // Check annotation changes
  if (JSON.stringify(oldDef.annotations) !== JSON.stringify(newDef.annotations)) {
    changes.push({
      kind: "schema_changed",
      summary: `Tool annotations changed`,
    });
  }

  // Check isWrite / requiresApproval changes
  if (oldDef.isWrite !== newDef.isWrite) {
    changes.push({
      kind: "schema_changed",
      summary: `Write permission changed: ${oldDef.isWrite} → ${newDef.isWrite}`,
    });
  }

  return changes;
}

/**
 * Diff two JSON Schema objects and return human-readable descriptions of changes.
 */
function diffInputSchemas(
  oldSchema?: Record<string, unknown> | null,
  newSchema?: Record<string, unknown> | null
): string[] {
  const diffs: string[] = [];

  const safeOld = oldSchema && typeof oldSchema === "object" ? oldSchema : {};
  const safeNew = newSchema && typeof newSchema === "object" ? newSchema : {};

  const oldProps = (safeOld.properties ?? {}) as Record<string, Record<string, unknown>>;
  const newProps = (safeNew.properties ?? {}) as Record<string, Record<string, unknown>>;
  const oldRequired = new Set((safeOld.required ?? []) as string[]);
  const newRequired = new Set((safeNew.required ?? []) as string[]);

  // Added properties
  for (const name of Object.keys(newProps)) {
    if (!(name in oldProps)) {
      const prop = newProps[name];
      const type = typeof prop?.type === "string" ? prop.type : "unknown";
      const required = newRequired.has(name) ? " (required)" : "";
      diffs.push(`added parameter "${name}" (${type}${required})`);
    }
  }

  // Removed properties
  for (const name of Object.keys(oldProps)) {
    if (!(name in newProps)) {
      diffs.push(`removed parameter "${name}"`);
    }
  }

  // Changed properties (type or description)
  for (const name of Object.keys(newProps)) {
    if (name in oldProps) {
      const oldProp = oldProps[name];
      const newProp = newProps[name];
      if (oldProp?.type !== newProp?.type) {
        diffs.push(`parameter "${name}" type changed: ${oldProp?.type} → ${newProp?.type}`);
      }
      if ((oldProp?.description ?? "") !== (newProp?.description ?? "")) {
        diffs.push(`parameter "${name}" description updated`);
      }
    }
  }

  // Required changes
  for (const name of newRequired) {
    if (!oldRequired.has(name) && name in newProps) {
      diffs.push(`parameter "${name}" is now required`);
    }
  }
  for (const name of oldRequired) {
    if (!newRequired.has(name) && name in newProps) {
      diffs.push(`parameter "${name}" is no longer required`);
    }
  }

  return diffs;
}

function buildAddedSummary(def: McpToolDefinition): string {
  const props = (def.inputSchema?.properties ?? {}) as Record<string, unknown>;
  const required = (def.inputSchema?.required ?? []) as string[];
  const paramCount = Object.keys(props).length;
  const requiredCount = required.length;
  const parts = [`New tool "${def.name}"`];
  if (def.description) parts.push(`— ${def.description.slice(0, 80)}`);
  parts.push(`(${paramCount} params, ${requiredCount} required)`);
  if (def.isWrite) parts.push("[WRITE]");
  return parts.join(" ");
}

/**
 * Apply selected tool updates to a skill's allowedTools array.
 * Returns the updated allowedTools list.
 */
export function applyToolUpdates(
  currentAllowedTools: string[],
  changes: McpToolChange[],
  serverId: string,
  toolNames?: string[]
): string[] {
  const result = new Set(currentAllowedTools);

  for (const change of changes) {
    // Filter by toolNames if specified
    if (toolNames && !toolNames.includes(change.toolName)) continue;

    const registryName = `mcp_${serverId}_${change.toolName}`;

    if (change.kind === "added" || change.kind === "schema_changed") {
      // Ensure the tool is in the allowed list
      result.add(registryName);
    } else if (change.kind === "removed") {
      // Optionally remove from allowed list (user may want to keep it)
      // For safety, we don't auto-remove — the user can manually clean up
    }
  }

  return Array.from(result);
}
