import type { MissionPayload, MissionStep } from "../../types/missions";
import { normalizeMissionChoiceOrder } from "../missionChoiceOrder";

export type MissionValidationResult = { ok: true } | { ok: false; reason: string };

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNonEmptyStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(asNonEmptyString).filter((item): item is string => Boolean(item));
  return items.length === value.length ? items : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateStep(step: unknown, index: number): MissionValidationResult {
  if (!isObject(step)) return { ok: false, reason: `steps[${index}] must be an object` };

  const stepOrder = step.stepOrder;
  const stepType = step.stepType;
  const title = asNonEmptyString(step.title);

  if (typeof stepOrder !== "number" || !Number.isFinite(stepOrder)) {
    return { ok: false, reason: `steps[${index}].stepOrder must be a number` };
  }
  if (!title) return { ok: false, reason: `steps[${index}].title is required` };
  if (stepType !== "intro" && stepType !== "input" && stepType !== "choice" && stepType !== "concept") {
    return { ok: false, reason: `steps[${index}].stepType is invalid` };
  }

  if ((stepType === "input" || stepType === "choice") && !asNonEmptyString(step.correctAnswer)) {
    return { ok: false, reason: `steps[${index}].correctAnswer is required for ${stepType} step` };
  }

  if (step.acceptedAnswers !== undefined && !asNonEmptyStringArray(step.acceptedAnswers)) {
    return { ok: false, reason: `steps[${index}].acceptedAnswers must contain only non-empty strings` };
  }

  if (step.acceptedUnits !== undefined && !asNonEmptyStringArray(step.acceptedUnits)) {
    return { ok: false, reason: `steps[${index}].acceptedUnits must contain only non-empty strings` };
  }

  if (step.hintLevel1 !== undefined && !asNonEmptyString(step.hintLevel1)) {
    return { ok: false, reason: `steps[${index}].hintLevel1 must be a non-empty string when provided` };
  }

  if (step.hintLevel2 !== undefined && !asNonEmptyString(step.hintLevel2)) {
    return { ok: false, reason: `steps[${index}].hintLevel2 must be a non-empty string when provided` };
  }

  if (step.hintLevel3 !== undefined && !asNonEmptyString(step.hintLevel3)) {
    return { ok: false, reason: `steps[${index}].hintLevel3 must be a non-empty string when provided` };
  }

  if (step.hints !== undefined) {
    if (!Array.isArray(step.hints) || step.hints.length === 0) {
      return { ok: false, reason: `steps[${index}].hints must be a non-empty array when provided` };
    }

    for (let hintIndex = 0; hintIndex < step.hints.length; hintIndex += 1) {
      const hint = step.hints[hintIndex];
      if (!isObject(hint)) {
        return { ok: false, reason: `steps[${index}].hints[${hintIndex}] must be an object` };
      }
      if (hint.level !== 1 && hint.level !== 2 && hint.level !== 3) {
        return { ok: false, reason: `steps[${index}].hints[${hintIndex}].level must be 1|2|3` };
      }
      if (!asNonEmptyString(hint.text)) {
        return { ok: false, reason: `steps[${index}].hints[${hintIndex}].text is required` };
      }
    }
  }

  if (step.solution !== undefined) {
    if (!isObject(step.solution)) {
      return { ok: false, reason: `steps[${index}].solution must be an object` };
    }
    if (!asNonEmptyString(step.solution.summary)) {
      return { ok: false, reason: `steps[${index}].solution.summary is required` };
    }
    if (!asNonEmptyStringArray(step.solution.steps)?.length) {
      return { ok: false, reason: `steps[${index}].solution.steps must contain at least one item` };
    }
    if (!asNonEmptyString(step.solution.concept)) {
      return { ok: false, reason: `steps[${index}].solution.concept is required` };
    }
    if (step.solution.commonMistake !== undefined && !asNonEmptyString(step.solution.commonMistake)) {
      return { ok: false, reason: `steps[${index}].solution.commonMistake must be a non-empty string when provided` };
    }
  }

  if (stepType === "choice") {
    const choices = asNonEmptyStringArray(step.choices);
    if (!choices || choices.length < 2) {
      return { ok: false, reason: `steps[${index}].choices must contain at least 2 items for choice step` };
    }

    if (new Set(choices).size !== choices.length) {
      return { ok: false, reason: `steps[${index}].choices must be unique` };
    }

    const correctAnswer = asNonEmptyString(step.correctAnswer);
    if (!correctAnswer || !choices.includes(correctAnswer)) {
      return { ok: false, reason: `steps[${index}].correctAnswer must match one of the choices` };
    }
  }

  return { ok: true };
}

export function validateMission(payload: unknown): MissionValidationResult {
  if (!isObject(payload)) return { ok: false, reason: "mission payload must be an object" };

  if (!asNonEmptyString(payload.title)) return { ok: false, reason: "title is required" };
  if (!asNonEmptyString(payload.scenario)) return { ok: false, reason: "scenario is required" };
  if (!asNonEmptyString(payload.conceptSummary)) return { ok: false, reason: "conceptSummary is required" };

  const difficulty = payload.difficulty;
  if (difficulty !== "easy" && difficulty !== "normal" && difficulty !== "challenge") {
    return { ok: false, reason: "difficulty must be one of easy|normal|challenge" };
  }

  if (typeof payload.estimatedMinutes !== "number" || !Number.isFinite(payload.estimatedMinutes)) {
    return { ok: false, reason: "estimatedMinutes must be a number" };
  }

  if (!Array.isArray(payload.steps)) return { ok: false, reason: "steps must be an array" };
  if (payload.steps.length < 3) return { ok: false, reason: "steps must contain at least 3 items" };

  for (let i = 0; i < payload.steps.length; i += 1) {
    const stepResult = validateStep(payload.steps[i], i);
    if (!stepResult.ok) return stepResult;
  }

  return { ok: true };
}

export function toMissionPayload(payload: unknown): MissionPayload | null {
  const result = validateMission(payload);
  if (!result.ok) return null;
  const data = payload as MissionPayload;
  const steps = [...data.steps]
    .map((step) => ({ ...step }))
    .sort((a: MissionStep, b: MissionStep) => a.stepOrder - b.stepOrder);

  return normalizeMissionChoiceOrder({
    ...data,
    estimatedMinutes: Math.max(1, Math.round(data.estimatedMinutes)),
    steps,
  });
}
