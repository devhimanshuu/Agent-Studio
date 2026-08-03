import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { InvalidSkillError, InvalidInputError } from "./errors";

/** Validate the skill is executable (exists, not archived). */
export function validateSkillForExecution(skill: SkillDTO | null): void {
  if (!skill) throw new InvalidSkillError("Skill not found");
  if (skill.status === "ARCHIVED") {
    throw new InvalidSkillError("Archived skills cannot be executed");
  }
}

/** Validate the version is executable (exists, sane step limit). */
export function validateVersionForExecution(version: SkillVersionDTO | null): void {
  if (!version) throw new InvalidSkillError("Skill version not found");
  if (version.maxExecutionSteps < 1) {
    throw new InvalidSkillError("Skill version has an invalid maxExecutionSteps value");
  }
}

/**
 * Lightweight structural validation of the user input against the version's
 * input schema: any `required` property declared by the JSON schema must be
 * present. (Deep JSON-schema validation can be layered on later without
 * touching the runtime.)
 */
export function validateUserInput(input: Record<string, unknown>, version: SkillVersionDTO): void {
  const required = version.inputSchema?.required;
  if (Array.isArray(required)) {
    for (const key of required) {
      if (typeof key === "string" && !(key in input)) {
        throw new InvalidInputError(`Missing required input field: "${key}"`);
      }
    }
  }
}
