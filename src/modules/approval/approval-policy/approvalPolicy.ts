import { ApprovalPolicy } from "@/types/approval";
import { SkillVersionDTO } from "@/types/skill";
import { PlannedStep } from "@/modules/execution/state/agentState";

type ApprovalPolicyStep = Pick<PlannedStep, "toolName" | "action" | "requiresApproval">;

/**
 * Evaluates all active approval policies against a planned step.
 * Returns true when the step MUST pause for human review before execution.
 *
 * Policy resolution order (first match wins):
 * 1. NEVER require approval — overrides everything below
 * 2. ALWAYS require approval — overrides tool-based and skill-based
 * 3. Tool-based: action name matches a tool flagged for HITL
 * 4. Skill-based: skill ID is in the approval-mandatory list
 * 5. Plan flag or skill's actionsRequiringApproval list
 * 6. The tool's own requiresApproval contract (WRITE tools)
 */
export function evaluateApprovalPolicy(
  step: ApprovalPolicyStep,
  tool: { requiresApproval: boolean } | null,
  version: SkillVersionDTO | null,
  policy: ApprovalPolicy,
  skillId: string
): boolean {
  // 1. Never require approval — override everything
  if (policy.neverRequireApproval) return false;

  // 2. Always require approval — override everything
  if (policy.alwaysRequireApproval) return true;

  // 3. Tool-based: check if this tool name is in the mandatory list
  if (policy.toolBasedApproval.includes(step.toolName)) return true;

  // 4. Skill-based: check if this skill is in the mandatory list
  if (policy.skillBasedApproval.includes(skillId)) return true;

  // 5. Plan flag or version's actionsRequiringApproval list
  if (step.requiresApproval) return true;
  if (version?.actionsRequiringApproval?.includes(step.action)) return true;

  // 6. Tool's own WRITE contract
  return Boolean(tool?.requiresApproval);
}

/** Default policy: no hardcoded overrides — rely on plan flags, version config,
 * and tool contracts. */
export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  alwaysRequireApproval: false,
  neverRequireApproval: false,
  toolBasedApproval: [],
  skillBasedApproval: [],
};