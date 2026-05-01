import type { MissionHint, MissionSolution } from "@/types/missions";
import { normalizeMissionChoiceOrder } from "./missionChoiceOrder";

export type GeneratedMissionStepPayload = {
  stepOrder: number;
  title: string;
  stepType: "input" | "concept" | "choice" | "writing";
  question?: string;
  inputPlaceholder?: string;
  answerType?: "number" | "text" | "equation" | "writing";
  correctAnswer?: string;
  acceptedAnswers?: string[];
  acceptedUnits?: string[];
  choices?: string[];
  hint?: string;
  hintLevel1?: string;
  hintLevel2?: string;
  hintLevel3?: string;
  hints?: MissionHint[];
  solution?: MissionSolution;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
  conceptTitle?: string;
  conceptDescription?: string;
  explanation?: string;
  expectedSentenceCount?: number;
  writingGuide?: string[];
  sampleAnswer?: string;
  keyExpressions?: string[];
  commonMistakes?: string[];
};

export type GeneratedMissionPayload = {
  missionKey: string;
  title: string;
  scenario: string;
  essentialQuestion: string;
  conceptSummary: string;
  difficulty: "easy" | "normal" | "hard" | "challenge";
  estimatedMinutes: number;
  steps: GeneratedMissionStepPayload[];
};

export const AI_MISSION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["missionKey", "title", "scenario", "essentialQuestion", "conceptSummary", "difficulty", "estimatedMinutes", "steps"],
  properties: {
    missionKey: { type: "string", minLength: 3 },
    title: { type: "string", minLength: 3 },
    scenario: { type: "string", minLength: 5 },
    essentialQuestion: { type: "string", minLength: 5 },
    conceptSummary: { type: "string", minLength: 5 },
    difficulty: { type: "string", enum: ["easy", "normal", "challenge"] },
    estimatedMinutes: { type: "integer", minimum: 1, maximum: 60 },
    steps: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stepOrder", "title", "stepType"],
        properties: {
          stepOrder: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 2 },
          stepType: { type: "string", enum: ["input", "concept", "choice", "writing"] },
          question: { type: "string" },
          inputPlaceholder: { type: "string" },
          answerType: { type: "string", enum: ["number", "text", "equation", "writing"] },
          correctAnswer: { type: "string" },
          acceptedAnswers: { type: "array", items: { type: "string", minLength: 1 } },
          acceptedUnits: { type: "array", items: { type: "string", minLength: 1 } },
          choices: { type: "array", minItems: 2, items: { type: "string", minLength: 1 } },
          hint: { type: "string" },
          hintLevel1: { type: "string" },
          hintLevel2: { type: "string" },
          hintLevel3: { type: "string" },
          hints: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["level", "text"],
              properties: {
                level: { type: "integer", enum: [1, 2, 3] },
                text: { type: "string", minLength: 1 },
              },
            },
          },
          solution: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "steps", "concept"],
            properties: {
              summary: { type: "string", minLength: 1 },
              steps: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
              concept: { type: "string", minLength: 1 },
            },
          },
          feedbackCorrect: { type: "string" },
          feedbackIncorrect: { type: "string" },
          conceptTitle: { type: "string" },
          conceptDescription: { type: "string" },
          explanation: { type: "string" },
          expectedSentenceCount: { type: "integer", minimum: 1, maximum: 20 },
          writingGuide: { type: "array", items: { type: "string", minLength: 1 } },
          sampleAnswer: { type: "string" },
          keyExpressions: { type: "array", items: { type: "string", minLength: 1 } },
          commonMistakes: { type: "array", items: { type: "string", minLength: 1 } },
        },
      },
    },
  },
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(asString).filter((item): item is string => Boolean(item));
  return items.length === value.length ? items : undefined;
}

function parseHints(value: unknown): MissionHint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const hints = value
    .map((item) => {
      if (!isObject(item)) return null;
      const level = item.level;
      const text = asString(item.text);
      if ((level !== 1 && level !== 2 && level !== 3) || !text) return null;
      return { level, text } as MissionHint;
    })
    .filter((item): item is MissionHint => Boolean(item));
  return hints.length > 0 ? hints : undefined;
}

function parseSolution(value: unknown): MissionSolution | undefined {
  if (!isObject(value)) return undefined;
  const summary = asString(value.summary);
  const concept = asString(value.concept);
  const steps = asStringArray(value.steps);
  if (!summary || !concept || !steps || steps.length === 0) return undefined;
  const commonMistake = asString(value.commonMistake) ?? undefined;
  return { summary, concept, steps, commonMistake };
}

export function parseGeneratedMissionPayload(value: unknown): GeneratedMissionPayload | null {
  if (!isObject(value)) return null;

  const missionKey = asString(value.missionKey);
  const title = asString(value.title);
  const scenario = asString(value.scenario);
  const essentialQuestion = asString(value.essentialQuestion);
  const conceptSummary = asString(value.conceptSummary);
  const difficulty = value.difficulty;
  const estimatedMinutes = value.estimatedMinutes;
  const steps = value.steps;

  if (!missionKey || !title || !scenario || !essentialQuestion || !conceptSummary) return null;
  if (difficulty !== "easy" && difficulty !== "normal" && difficulty !== "hard" && difficulty !== "challenge") return null;
  if (typeof estimatedMinutes !== "number" || !Number.isFinite(estimatedMinutes)) return null;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const parsedSteps: GeneratedMissionStepPayload[] = [];
  for (const step of steps) {
    if (!isObject(step)) return null;
    const stepOrder = step.stepOrder;
    const stepTitle = asString(step.title);
    const stepType = step.stepType;
    if (typeof stepOrder !== "number" || !Number.isFinite(stepOrder) || !stepTitle) return null;
    if (stepType !== "input" && stepType !== "concept" && stepType !== "choice" && stepType !== "writing") return null;

    parsedSteps.push({
      stepOrder,
      title: stepTitle,
      stepType,
      question: asString(step.question) ?? undefined,
      inputPlaceholder: asString(step.inputPlaceholder) ?? undefined,
      answerType: (["number", "text", "equation", "writing"] as const).includes(step.answerType as never)
        ? (step.answerType as GeneratedMissionStepPayload["answerType"])
        : undefined,
      correctAnswer: asString(step.correctAnswer) ?? undefined,
      acceptedAnswers: asStringArray(step.acceptedAnswers),
      acceptedUnits: asStringArray(step.acceptedUnits),
      choices: asStringArray(step.choices),
      hint: asString(step.hint) ?? undefined,
      hintLevel1: asString(step.hintLevel1) ?? undefined,
      hintLevel2: asString(step.hintLevel2) ?? undefined,
      hintLevel3: asString(step.hintLevel3) ?? undefined,
      hints: parseHints(step.hints),
      solution: parseSolution(step.solution),
      feedbackCorrect: asString(step.feedbackCorrect) ?? undefined,
      feedbackIncorrect: asString(step.feedbackIncorrect) ?? undefined,
      conceptTitle: asString(step.conceptTitle) ?? undefined,
      conceptDescription: asString(step.conceptDescription) ?? undefined,
      explanation: asString(step.explanation) ?? undefined,
      expectedSentenceCount:
        typeof step.expectedSentenceCount === "number" && Number.isFinite(step.expectedSentenceCount)
          ? Math.max(1, Math.round(step.expectedSentenceCount))
          : undefined,
      writingGuide: asStringArray(step.writingGuide),
      sampleAnswer: asString(step.sampleAnswer) ?? undefined,
      keyExpressions: asStringArray(step.keyExpressions),
      commonMistakes: asStringArray(step.commonMistakes),
    });
  }

  return normalizeMissionChoiceOrder({
    missionKey,
    title,
    scenario,
    essentialQuestion,
    conceptSummary,
    difficulty,
    estimatedMinutes: Math.round(estimatedMinutes),
    steps: parsedSteps.sort((a, b) => a.stepOrder - b.stepOrder),
  }) as unknown as GeneratedMissionPayload;
}
