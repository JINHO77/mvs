import { allGeneratedMissionSeeds } from "@/data/missions/generatedMissions";
import { getConcept } from "@/lib/concepts";
import { normalizeMissionChoiceOrder } from "@/lib/missionChoiceOrder";
import { getConceptNode } from "@/lib/conceptMap";
import { evaluateBadgesForStudent } from "@/lib/badges";
import { getHintAdjustedXp } from "@/lib/missionAnswers";
import { supabase } from "@/lib/supabaseClient";
import type {
  CompareConfig,
  CompareSubQuestion,
  CurriculumUnit,
  DragAndDropConfig,
  FillInBlanksBlank,
  FillInBlanksConfig,
  GeneratedMission,
  MissionHint,
  MissionAttempt,
  MissionPayload,
  MissionSolution,
  MissionSeed,
  MissionStep,
  SelfExplainConfig,
  StudentMissionStats,
  StudentXpSummary,
  TodayRecommendedMission,
} from "@/types/missions";
import type { EarnedBadgeSummary } from "@/types/badges";

type GeneratedMissionRow = Omit<GeneratedMission, "mission_json" | "interest_tags"> & {
  mission_json: unknown;
  interest_tags: unknown;
};

export type MathHomeUnitCard = CurriculumUnit & {
  missionCount: number;
  latestMissionCreatedAt: string | null;
};

type MathMissionSummaryRow = {
  unit_id: string;
  created_at: string;
};

type VisibleMissionCountSummary = {
  missionCount: number;
  latestMissionCreatedAt: string | null;
};

const GENERATED_MISSION_SELECT =
  "id,subject,unit_id,title,interest_tags,difficulty,estimated_minutes,source_type,status,mission_json,quality_notes,created_by,reviewed_by,reviewed_at,published_at,is_active,created_at,updated_at";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringOrNumber(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

function parseMissionHint(value: unknown): MissionHint | null {
  if (!isObject(value)) return null;
  const level = value.level;
  const text = asString(value.text);
  if ((level !== 1 && level !== 2 && level !== 3) || !text) return null;
  return { level, text };
}

function parseMissionHints(value: unknown): MissionHint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const hints = value.map(parseMissionHint).filter((hint): hint is MissionHint => hint !== null);
  return hints.length > 0 ? hints : undefined;
}

function extractStringHints(value: unknown): [string?, string?, string?] {
  if (!Array.isArray(value)) return [];
  const strings = value.filter((h): h is string => typeof h === "string" && h.trim().length > 0);
  return [strings[0], strings[1], strings[2]];
}

function parseMissionSolution(value: unknown): MissionSolution | undefined {
  if (!isObject(value)) return undefined;
  const summary = asString(value.summary);
  const concept = asString(value.concept);
  const steps = asStringArray(value.steps);
  if (!summary || !concept || !steps || steps.length === 0) return undefined;
  const commonMistake = asString(value.commonMistake) ?? asString(value.common_mistake) ?? undefined;
  return { summary, concept, steps, commonMistake };
}

function parseSelfExplainConfig(value: unknown): SelfExplainConfig | undefined {
  if (!isObject(value)) return undefined;
  const question = asString(value.question) ?? asString(value.prompt);
  const answer = asString(value.answer) ?? asStringOrNumber(value.answer);
  const explanationPrompt = asString(value.explanationPrompt) ?? asString(value.explanation_prompt);
  if (!question || !answer || !explanationPrompt) return undefined;

  const rawAnswerType = asString(value.answerType) ?? asString(value.answer_type) ?? "short";
  const answerType: SelfExplainConfig["answerType"] =
    rawAnswerType === "multiple_choice" || rawAnswerType === "number" ? rawAnswerType : "short";

  const expectedKeywords = asStringArray(value.expectedKeywords) ?? asStringArray(value.expected_keywords) ?? [];
  const minKeywordsRaw = value.minKeywords ?? value.min_keywords;
  const minLengthRaw = value.minLength ?? value.min_length;
  const minKeywords = typeof minKeywordsRaw === "number" && Number.isFinite(minKeywordsRaw)
    ? Math.max(0, Math.round(minKeywordsRaw))
    : Math.min(2, expectedKeywords.length);
  const minLength = typeof minLengthRaw === "number" && Number.isFinite(minLengthRaw)
    ? Math.max(0, Math.round(minLengthRaw))
    : 30;
  const sampleExplanation = asString(value.sampleExplanation) ?? asString(value.sample_explanation) ?? "";
  const choices = asStringArray(value.choices);

  return {
    prompt: asString(value.prompt) ?? undefined,
    question,
    answer,
    answerType,
    choices,
    explanationPrompt,
    expectedKeywords,
    minKeywords,
    minLength,
    sampleExplanation,
  };
}

function parseFillInBlanksConfig(value: unknown): FillInBlanksConfig | undefined {
  if (!isObject(value)) return undefined;
  const template = asString(value.template);
  const blanksRaw = Array.isArray(value.blanks) ? value.blanks : null;
  if (!template || !blanksRaw) return undefined;

  const blanks: FillInBlanksBlank[] = [];
  for (const entry of blanksRaw) {
    if (!isObject(entry)) continue;
    const idRaw = entry.id;
    const id = typeof idRaw === "number" && Number.isFinite(idRaw)
      ? Math.round(idRaw)
      : Number.parseInt(asString(idRaw) ?? "", 10);
    const answer = asString(entry.answer);
    if (!Number.isFinite(id) || !answer) continue;
    blanks.push({
      id,
      answer,
      alternatives: asStringArray(entry.alternatives) ?? [],
      hint: asString(entry.hint) ?? undefined,
    });
  }
  if (blanks.length === 0) return undefined;

  return {
    prompt: asString(value.prompt) ?? undefined,
    template,
    blanks,
  };
}

function parseDragAndDropConfig(value: unknown): DragAndDropConfig | undefined {
  if (!isObject(value)) return undefined;
  const rawMode = asString(value.mode);
  const mode: DragAndDropConfig["mode"] = rawMode === "match" ? "match" : "classify";

  const categories = Array.isArray(value.categories)
    ? value.categories
        .map((entry): { id: string; label: string; color?: string } | null => {
          if (!isObject(entry)) return null;
          const id = asString(entry.id);
          const label = asString(entry.label);
          if (!id || !label) return null;
          const color = asString(entry.color);
          return color ? { id, label, color } : { id, label };
        })
        .filter((entry): entry is { id: string; label: string; color?: string } => entry !== null)
    : undefined;

  const items = Array.isArray(value.items)
    ? value.items
        .map((entry) => {
          if (!isObject(entry)) return null;
          const text = asString(entry.text);
          const correctCategory = asString(entry.correctCategory) ?? asString(entry.correct_category);
          if (!text || !correctCategory) return null;
          return { text, correctCategory };
        })
        .filter((entry): entry is { text: string; correctCategory: string } => entry !== null)
    : undefined;

  const parseColumn = (raw: unknown) =>
    Array.isArray(raw)
      ? raw
          .map((entry) => {
            if (!isObject(entry)) return null;
            const id = asString(entry.id);
            const text = asString(entry.text);
            if (!id || !text) return null;
            return { id, text };
          })
          .filter((entry): entry is { id: string; text: string } => entry !== null)
      : undefined;

  const leftColumn = parseColumn(value.leftColumn ?? value.left_column);
  const rightColumn = parseColumn(value.rightColumn ?? value.right_column);

  const correctPairsRaw = (value.correctPairs ?? value.correct_pairs) as unknown;
  const correctPairs: Array<[string, string]> | undefined = Array.isArray(correctPairsRaw)
    ? correctPairsRaw
        .map((pair): [string, string] | null => {
          if (!Array.isArray(pair) || pair.length < 2) return null;
          const a = asString(pair[0]);
          const b = asString(pair[1]);
          if (!a || !b) return null;
          return [a, b];
        })
        .filter((pair): pair is [string, string] => pair !== null)
    : undefined;

  if (mode === "classify" && (!categories || !items)) return undefined;
  if (mode === "match" && (!leftColumn || !rightColumn || !correctPairs)) return undefined;

  return {
    prompt: asString(value.prompt) ?? undefined,
    mode,
    categories,
    items,
    leftColumn,
    rightColumn,
    correctPairs,
  };
}

function parseCompareConfig(value: unknown): CompareConfig | undefined {
  if (!isObject(value)) return undefined;
  const question = asString(value.question);
  const answersRaw = Array.isArray(value.answers) ? value.answers : null;
  const subQuestionsRaw = Array.isArray(value.questions) ? value.questions : null;
  if (!question || !answersRaw || !subQuestionsRaw) return undefined;

  const answers = answersRaw
    .map((entry) => {
      if (!isObject(entry)) return null;
      const id = asString(entry.id);
      const label = asString(entry.label);
      if (!id || !label) return null;
      return {
        id,
        label,
        answer: asString(entry.answer) ?? asStringOrNumber(entry.answer) ?? undefined,
        work: asString(entry.work) ?? undefined,
        reasoning: asString(entry.reasoning) ?? undefined,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const subQuestions: CompareSubQuestion[] = [];
  for (const entry of subQuestionsRaw) {
    if (!isObject(entry)) continue;
    const type = asString(entry.type);
    const prompt = asString(entry.prompt);
    if (!prompt) continue;
    if (type === "select_better") {
      const options = asStringArray(entry.options);
      const answerRaw = entry.answer;
      const answer = typeof answerRaw === "number" && Number.isFinite(answerRaw)
        ? Math.round(answerRaw)
        : Number.parseInt(asString(answerRaw) ?? "", 10);
      if (!options || options.length === 0 || !Number.isFinite(answer)) continue;
      subQuestions.push({ type: "select_better", prompt, options, answer });
    } else if (type === "explain") {
      const expectedKeywords = asStringArray(entry.expectedKeywords) ?? asStringArray(entry.expected_keywords) ?? [];
      const minKeywordsRaw = entry.minKeywords ?? entry.min_keywords;
      const minLengthRaw = entry.minLength ?? entry.min_length;
      const minKeywords = typeof minKeywordsRaw === "number" && Number.isFinite(minKeywordsRaw)
        ? Math.max(0, Math.round(minKeywordsRaw))
        : Math.min(2, expectedKeywords.length);
      const minLength = typeof minLengthRaw === "number" && Number.isFinite(minLengthRaw)
        ? Math.max(0, Math.round(minLengthRaw))
        : 30;
      subQuestions.push({ type: "explain", prompt, expectedKeywords, minKeywords, minLength });
    }
  }

  if (answers.length === 0 || subQuestions.length === 0) return undefined;

  return {
    prompt: asString(value.prompt) ?? undefined,
    passage: asString(value.passage) ?? undefined,
    question,
    answers,
    questions: subQuestions,
  };
}

function parseMissionStep(value: unknown): MissionStep | null {
  if (!isObject(value)) return null;

  const stepOrder = typeof value.stepOrder === "number" ? value.stepOrder : value.step_order;
  const title = asString(value.title);
  // Normalize legacy/alternate type names to canonical internal types
  const rawStepType = asString(value.stepType) ?? asString(value.step_type) ?? asString(value.type);
  const stepType =
    rawStepType === "multiple_choice" ? "choice" :
    rawStepType === "short_answer" ? "input" :
    rawStepType === "concept_check" || rawStepType === "concept_summary" ? "concept" :
    rawStepType === "free_response" || rawStepType === "paragraph" ||
    rawStepType === "paragraph_response" || rawStepType === "scenario_response" ? "writing" :
    rawStepType === "classification" ? "drag_and_drop" :
    rawStepType;
  if (typeof stepOrder !== "number" || !Number.isFinite(stepOrder)) return null;
  if (!title) return null;
  if (
    stepType !== "intro" && stepType !== "input" && stepType !== "choice" &&
    stepType !== "multi_select" && stepType !== "concept" && stepType !== "writing" &&
    stepType !== "self_explain" && stepType !== "fill_in_blanks" &&
    stepType !== "drag_and_drop" && stepType !== "compare"
  ) return null;

  const choicesRaw = value.choices ?? value.options;
  const choices = Array.isArray(choicesRaw)
    ? choicesRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const correctChoiceIndexesRaw = Array.isArray(value.answers)
    ? value.answers
    : Array.isArray(value.answer)
      ? value.answer
      : typeof value.answer === "number"
        ? [value.answer]
        : [];
  const correctChoiceIndexes = correctChoiceIndexesRaw
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    .map((item) => Math.max(0, Math.round(item)));

  // For choice steps, correctAnswer must be the text of one of the choices (not an index).
  // If stored as a numeric index (e.g. correctAnswer: 2), resolve it to choices[2].
  // If still unresolvable, fall back to correctChoiceIndexes[0] as a last resort.
  const rawCorrectAnswer = asStringOrNumber(value.correctAnswer) ?? asStringOrNumber(value.correct_answer) ?? undefined;
  const resolvedCorrectAnswer: string | undefined = (() => {
    if (stepType !== "choice" || !choices) return rawCorrectAnswer;
    if (rawCorrectAnswer !== undefined) {
      if (choices.includes(rawCorrectAnswer)) return rawCorrectAnswer;
      const numericIndex = Number(rawCorrectAnswer);
      if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < choices.length) {
        return choices[numericIndex];
      }
    }
    if (correctChoiceIndexes.length > 0) {
      const idx = correctChoiceIndexes[0];
      if (idx >= 0 && idx < choices.length) return choices[idx];
    }
    return rawCorrectAnswer;
  })();

  return {
    stepOrder: Math.max(1, Math.round(stepOrder)),
    title,
    stepType,
    question: asString(value.question) ?? asString(value.prompt) ?? undefined,
    explanation: asString(value.explanation) ?? asString(value.content) ?? undefined,
    inputPlaceholder: asString(value.inputPlaceholder) ?? asString(value.placeholder) ?? undefined,
    answerType: ["number", "text", "equation"].includes(asString(value.answerType) ?? asString(value.answer_type) ?? "")
      ? ((asString(value.answerType) ?? asString(value.answer_type)) as MissionStep["answerType"])
      : undefined,
    correctAnswer: resolvedCorrectAnswer,
    acceptedAnswers: asStringArray(value.acceptedAnswers) ?? asStringArray(value.accepted_answers),
    acceptedUnits: asStringArray(value.acceptedUnits) ?? asStringArray(value.accepted_units),
    choices,
    correctChoiceIndexes: correctChoiceIndexes.length > 0 ? Array.from(new Set(correctChoiceIndexes)) : undefined,
    hint: asString(value.hint) ?? undefined,
    hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? undefined,
    hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? undefined,
    hintLevel3: asString(value.hintLevel3) ?? asString(value.hint_level3) ?? undefined,
    hints: parseMissionHints(value.hints),
    solution: parseMissionSolution(value.solution),
    feedbackCorrect: asString(value.feedbackCorrect) ?? undefined,
    feedbackIncorrect: asString(value.feedbackIncorrect) ?? undefined,
    conceptTitle: asString(value.conceptTitle) ?? undefined,
    conceptDescription: asString(value.conceptDescription) ?? undefined,
    // Writing-step fields (populated when stepType === "writing")
    expectedSentenceCount: (() => {
      const raw = value.expectedSentenceCount ?? value.expected_sentence_count;
      return typeof raw === "number" && Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : undefined;
    })(),
    writingGuide: asStringArray(value.writingGuide) ?? asStringArray(value.writing_guide) ?? undefined,
    sampleAnswer: asString(value.sampleAnswer) ?? asString(value.sample_answer) ?? undefined,
    keyExpressions: asStringArray(value.keyExpressions) ?? asStringArray(value.key_expressions) ?? undefined,
    commonMistakes: asStringArray(value.commonMistakes) ?? asStringArray(value.common_mistakes) ?? undefined,
    selfExplain: stepType === "self_explain" ? parseSelfExplainConfig(value.selfExplain ?? value.self_explain ?? value) : undefined,
    fillInBlanks: stepType === "fill_in_blanks" ? parseFillInBlanksConfig(value.fillInBlanks ?? value.fill_in_blanks ?? value) : undefined,
    dragAndDrop: stepType === "drag_and_drop" ? parseDragAndDropConfig(value.dragAndDrop ?? value.drag_and_drop ?? value) : undefined,
    compare: stepType === "compare" ? parseCompareConfig(value.compare ?? value) : undefined,
  };
}

function normalizeSeedMission(seed: MissionSeed): MissionSeed {
  const steps =
    seed.mission_json.steps.length > 0
      ? seed.mission_json.steps
      : [
          {
            id: "placeholder-concept",
            step_type: "concept" as const,
            step_title: "Warmup",
            description: "Detailed steps will be added in the next update.",
          },
        ];

  return {
    ...seed,
    mission_json: {
      ...seed.mission_json,
      steps,
    },
  };
}

export function getAllPublishedMissionSeeds(): MissionSeed[] {
  return allGeneratedMissionSeeds
    .filter((mission) => mission.status === "published")
    .map(normalizeSeedMission);
}

export function getMissionSeedById(missionId: string): MissionSeed | null {
  const found = allGeneratedMissionSeeds.find((mission) => mission.id === missionId && mission.status === "published");
  if (!found) return null;
  return normalizeSeedMission(found);
}

export function parseMissionPayload(value: unknown): MissionPayload | null {
  if (!isObject(value)) return null;

  const missionKey = asString(value.missionKey) ?? asString(value.mission_key);
  const title = asString(value.title);
  const scenario = asString(value.scenario);
  const essentialQuestion = asString(value.essentialQuestion) ?? asString(value.essential_question);
  const conceptSummary = asString(value.conceptSummary) ?? asString(value.concept_summary);
  const learningGoal = asString(value.learningGoal) ?? asString(value.learning_goal);
  const difficulty = value.difficulty;
  const estimatedMinutes = typeof value.estimatedMinutes === "number" ? value.estimatedMinutes : value.estimated_minutes;
  const steps = value.steps;

  if (!missionKey || !title || !scenario || !essentialQuestion || !conceptSummary) return null;
  if (difficulty !== "easy" && difficulty !== "normal" && difficulty !== "hard" && difficulty !== "challenge") return null;
  if (typeof estimatedMinutes !== "number" || !Number.isFinite(estimatedMinutes)) return null;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const parsedSteps = steps.map(parseMissionStep).filter((step): step is MissionStep => step !== null);
  if (parsedSteps.length === 0) return null;

  return normalizeMissionChoiceOrder({
    missionKey,
    title,
    scenario,
    essentialQuestion,
    conceptSummary,
    learningGoal: learningGoal ?? undefined,
    conceptTags: asStringArray(value.conceptTags) ?? asStringArray(value.concept_tags),
    mainConcept: asString(value.mainConcept) ?? asString(value.main_concept) ?? undefined,
    supportConcepts: asStringArray(value.supportConcepts) ?? asStringArray(value.support_concepts),
    difficulty,
    estimatedMinutes: Math.round(estimatedMinutes),
    steps: parsedSteps.sort((a, b) => a.stepOrder - b.stepOrder),
  });
}

function normalizeLegacyMissionPayload(
  row: GeneratedMissionRow
): MissionPayload | null {
  if (!isObject(row.mission_json)) return null;

  const raw = row.mission_json;
  return parseMissionPayload({
    ...raw,
    missionKey: asString(raw.missionKey) ?? asString(raw.mission_key) ?? `generated-${row.id}`,
    title: asString(raw.title) ?? row.title,
    scenario: asString(raw.scenario) ?? asString(raw.realLifeContext) ?? row.title,
    essentialQuestion:
      asString(raw.essentialQuestion) ??
      asString(raw.essential_question) ??
      asString(raw.learningGoal) ??
      row.title,
    conceptSummary:
      asString(raw.conceptSummary) ?? asString(raw.concept_summary) ?? asString(raw.learningGoal) ?? row.title,
    difficulty: raw.difficulty ?? row.difficulty,
    estimatedMinutes:
      (typeof raw.estimatedMinutes === "number" ? raw.estimatedMinutes : raw.estimated_minutes) ?? row.estimated_minutes,
  });
}

function normalizeAlternateMissionPayload(
  row: GeneratedMissionRow
): MissionPayload | null {
  if (!isObject(row.mission_json)) return null;

  const raw = row.mission_json;
  const intro = isObject(raw.intro) ? raw.intro : null;
  const wrapUp = isObject(raw.wrapUp) ? raw.wrapUp : null;
  const activities = Array.isArray(raw.activities) ? raw.activities : [];
  if (activities.length === 0) return null;

  const parsedActivitySteps = activities
    .map((activity, index) => parseLegacyActivityStep(activity, index))
    .filter((step): step is MissionStep => step !== null);
  if (parsedActivitySteps.length === 0) return null;

  const introTitle = asString(intro?.title) ?? row.title;
  const introText = asString(intro?.text);
  const wrapUpPrompt = asString(wrapUp?.prompt);
  const theme = asString(raw.theme);

  const steps: MissionStep[] = [];
  if (introText) {
    steps.push({
      stepOrder: 1,
      title: introTitle,
      stepType: "intro",
      explanation: introText,
    });
  }

  for (const step of parsedActivitySteps) {
    steps.push({
      ...step,
      stepOrder: steps.length + 1,
    });
  }

  if (wrapUpPrompt) {
    steps.push({
      stepOrder: steps.length + 1,
      title: "정리",
      stepType: "concept",
      question: wrapUpPrompt,
      explanation: wrapUpPrompt,
      conceptTitle: "학습 정리",
      conceptDescription: wrapUpPrompt,
    });
  }

  const firstPrompt =
    parsedActivitySteps.find((step) => typeof step.question === "string" && step.question.trim().length > 0)?.question ??
    wrapUpPrompt ??
    introText ??
    row.title;

  return normalizeMissionChoiceOrder({
    missionKey: asString(raw.missionKey) ?? asString(raw.mission_key) ?? `generated-${row.id}`,
    title: row.title,
    scenario: introText ?? row.title,
    essentialQuestion: firstPrompt,
    conceptSummary: theme ?? introText ?? row.title,
    learningGoal: wrapUpPrompt ?? firstPrompt,
    conceptTags: asStringArray(raw.conceptTags) ?? asStringArray(raw.concept_tags),
    mainConcept: theme ?? undefined,
    supportConcepts: asStringArray(raw.supportConcepts) ?? asStringArray(raw.support_concepts),
    difficulty: row.difficulty,
    estimatedMinutes: row.estimated_minutes,
    steps,
  });
}

function mapGeneratedMissionRow(
  row: GeneratedMissionRow
): GeneratedMission | null {
  const missionPayload =
    parseMissionPayload(row.mission_json) ??
    normalizeLegacyMissionPayload(row) ??
    normalizeAlternateMissionPayload(row);
  if (!missionPayload) return null;

  return {
    ...row,
    interest_tags: asStringArray(row.interest_tags) ?? null,
    mission_json: missionPayload,
  };
}

function getMissionMainConcept(mission: GeneratedMission): string | null {
  return typeof mission.mission_json.mainConcept === "string" && mission.mission_json.mainConcept.trim().length > 0
    ? mission.mission_json.mainConcept
    : null;
}

type StudentIdentity = {
  id: string;
};

export type MissionProgressSummary = {
  missionId: string;
  attemptId: string | null;
  status: "not_started" | "in_progress" | "completed";
  lastStep: number;
  totalSteps: number;
};

export type RecentCompletedMissionSummary = {
  missionId: string;
  title: string;
  completedAt: string;
};

export type MissionRecommendationStatus = "in_progress" | "completed_but_struggled" | "completed_ok";

export type StudentMissionRecommendationSignal = {
  missionId: string;
  started: boolean;
  completed: boolean;
  latestStatus: MissionAttempt["status"] | null;
  hasHintUsage: boolean;
  hasIncorrectAnswer: boolean;
  recommendationStatus: MissionRecommendationStatus;
};

export type ConceptMissionRecommendation = {
  concept: string;
  missionIds: string[];
};

export type WeakConceptAnalysis = {
  concept: string;
  score: number;
  recommendedMissionIds: string[];
  prerequisiteRecommendations: ConceptMissionRecommendation[];
  nextConceptIds: string[];
};

type LegacyMissionStepSavePayload = {
  attemptId: string;
  missionId: string;
  stepOrder: number;
  stepKey?: string;
  answerText?: string;
  isCorrect: boolean;
  elapsedMs?: number;
};

type MissionStepResultPayload = {
  attemptId: string;
  missionId?: string;
  stepOrder: number;
  stepType?: MissionStep["stepType"];
  studentAnswer: string | null;
  isCorrect: boolean | null;
  hintUsed: boolean;
  timeSpentSeconds?: number | null;
};

type CompleteMissionAttemptPayload = {
  attemptId: string;
  correctSteps: number;
  totalSteps: number;
};

export type MissionCompletionFeedback = {
  accuracy: number;
  correctSteps: number;
  totalSteps: number;
  gradableSteps: number;
  hintUsedCount: number;
  earnedXp: number;
  xpMessage: string;
  strengthMessage: string;
  reviewMessage: string;
  incorrectStepSummaries: Array<{
    stepOrder: number;
    title: string;
    summary: string;
  }>;
  newlyEarnedBadges: EarnedBadgeSummary[];
  // from process_mission_complete RPC
  level: number;
  prevLevel: number;
  leveledUp: boolean;
  xpToNextLevel: number;
  totalXp: number;
  streak: number;
  // 재도전(연습 모드) 표시. true면 XP/배지/레벨 변화 없음.
  isPractice: boolean;
  firstClearedAt: string | null;
  // RPC가 알려주는 XP 분해. 힌트 차감 표시에 사용.
  baseXp: number;
  bonusXp: number;
  hintPenaltyPct: number;
};

type MissionStepAttemptSummaryRow = {
  step_order: number;
  is_correct: boolean | null;
  student_answer?: string | null;
  answer_text?: string | null;
  step_type?: MissionStep["stepType"] | null;
  elapsed_ms?: number | null;
  time_spent_seconds?: number | null;
  hint_used?: boolean | null;
};

function toKstDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getKstDayBounds(base = new Date()): { startIso: string; endIso: string; dateKey: string } {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const shifted = new Date(base.getTime() + kstOffsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const startUtcMs = Date.UTC(year, month, day) - kstOffsetMs;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
    dateKey: toKstDateKey(base),
  };
}

function getKstWeekBounds(base = new Date()): { startIso: string; endIso: string } {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const shifted = new Date(base.getTime() + kstOffsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const dayOfWeek = shifted.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const startUtcMs = Date.UTC(year, month, day - daysFromMonday) - kstOffsetMs;
  const endUtcMs = startUtcMs + 7 * 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

async function getCurrentStudentIdentity(): Promise<StudentIdentity> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("\ub85c\uadf8\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: string | null }>();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "student") throw new Error("\ud559\uc0dd \uacc4\uc815\ub9cc \uc811\uadfc\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.");
  return { id: user.id };
}

function getSeedMissionStepCount(missionId: string): number {
  const seed = getMissionSeedById(missionId);
  return seed?.mission_json.steps.length ?? 0;
}

function isGradableMissionStep(step: MissionStep): boolean {
  return (
    step.stepType === "choice" ||
    step.stepType === "input" ||
    step.stepType === "multi_select" ||
    step.stepType === "self_explain" ||
    step.stepType === "fill_in_blanks" ||
    step.stepType === "drag_and_drop" ||
    step.stepType === "compare"
  );
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildMissionCompletionFeedback(args: {
  accuracy: number;
  correctSteps: number;
  totalSteps: number;
  gradableSteps: number;
  hintUsedCount: number;
  earnedXp: number;
  incorrectStepSummaries: MissionCompletionFeedback["incorrectStepSummaries"];
  isPractice?: boolean;
  firstClearedAt?: string | null;
  baseXp?: number;
  bonusXp?: number;
  hintPenaltyPct?: number;
}): Omit<MissionCompletionFeedback, 'level' | 'prevLevel' | 'leveledUp' | 'xpToNextLevel' | 'totalXp' | 'streak'> {
  let strengthMessage = "\uD55C \uBC88 \uB354 \uD480\uBA74 \uC2E4\uB825\uC774 \uB354 \uC548\uC815\uB420 \uC218 \uC788\uC5B4\uC694.";
  let reviewMessage = "\uD2C0\uB9B0 \uB2E8\uACC4 \uD574\uC124\uC744 \uB2E4\uC2DC \uC77D\uACE0 \uC720\uC0AC\uD55C \uBB38\uC81C\uB97C \uD55C \uBC88 \uB354 \uC5F0\uC2B5\uD574 \uBCF4\uC138\uC694.";

  if (args.accuracy >= 0.8) {
    strengthMessage = "\uAC1C\uB150 \uC774\uD574\uAC00 \uC88B\uC544\uC694. \uD575\uC2EC \uC815\uBCF4\uB97C \uC0C1\uD669\uACFC \uC798 \uC5F0\uACB0\uD588\uC5B4\uC694.";
    reviewMessage = "\uC9C0\uAE08\uCC98\uB7FC \uD480\uC774 \uADFC\uAC70\uB97C \uB9D0\uB85C \uC124\uBA85\uD558\uB294 \uC5F0\uC2B5\uC744 \uD558\uBA74 \uB354 \uD0C4\uD0C4\uD574\uC838\uC694.";
  } else if (args.accuracy >= 0.5) {
    strengthMessage = "\uC870\uAE08 \uB354 \uC5F0\uC2B5\uD558\uBA74 \uD480\uC774\uAC00 \uD6E8\uC52C \uC548\uC815\uB420 \uC218 \uC788\uC5B4\uC694.";
    reviewMessage = "\uD2C0\uB838\uB358 \uB2E8\uACC4\uC758 \uD575\uC2EC \uAC1C\uB150\uC744 \uB2E4\uC2DC \uC815\uB9AC\uD55C \uB4A4 \uD55C \uBC88 \uB354 \uD480\uC5B4 \uBCF4\uC138\uC694.";
  } else {
    strengthMessage = "\uAE30\uCD08 \uAC1C\uB150 \uBCF5\uC2B5\uC744 \uD1B5\uD574 \uD480\uC774 \uAE30\uBC18\uC744 \uB2E4\uC2DC \uB2E4\uC9C8 \uC2DC\uC810\uC785\uB2C8\uB2E4.";
    reviewMessage = "\uC0C1\uD669\uACFC \uAC1C\uB150 \uCE74\uB4DC\uB97C \uBA3C\uC800 \uBCF5\uC2B5\uD55C \uB4A4 \uD2C0\uB9B0 \uB2E8\uACC4\uB97C \uCC9C\uCC9C\uD788 \uB2E4\uC2DC \uD480\uC5B4 \uBCF4\uC138\uC694.";
  }

  return {
    accuracy: args.accuracy,
    correctSteps: args.correctSteps,
    totalSteps: args.totalSteps,
    gradableSteps: args.gradableSteps,
    hintUsedCount: args.hintUsedCount,
    earnedXp: args.earnedXp,
    xpMessage:
      args.hintUsedCount === 0
        ? "스스로 해결 보너스를 챙겼어요."
        : args.hintUsedCount === 1
          ? "힌트를 한 번만 보고 끝까지 해결했어요."
          : args.hintUsedCount === 2
            ? "힌트를 활용해 끝까지 해결했어요."
            : "다음엔 힌트를 덜 쓰고 더 많은 XP를 받아보세요.",
    strengthMessage,
    reviewMessage,
    incorrectStepSummaries: args.incorrectStepSummaries,
    newlyEarnedBadges: [],
    isPractice: args.isPractice ?? false,
    firstClearedAt: args.firstClearedAt ?? null,
    baseXp: args.baseXp ?? args.earnedXp,
    bonusXp: args.bonusXp ?? 0,
    hintPenaltyPct: args.hintPenaltyPct ?? 0,
  };
}

function isMissingColumnError(error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache") || message.includes("could not find");
}


function getAttemptDurationSeconds(startedAt: string | null | undefined, endedAt = new Date()): number | null {
  if (!startedAt) return null;
  const startedMs = new Date(startedAt).getTime();
  const endedMs = endedAt.getTime();
  if (!Number.isFinite(startedMs) || endedMs < startedMs) return null;
  return Math.max(1, Math.round((endedMs - startedMs) / 1000));
}

async function updateStudentMasterySummary(args: {
  studentId: string;
  unitId: string | null;
  accuracy: number;
  durationSec: number | null;
  correctSteps: number;
  gradableSteps: number;
  attemptedAt: string;
}): Promise<void> {
  if (!args.unitId) return;

  const existingRes = await supabase
    .from("student_mastery")
    .select("mastery_score,solved_count,attempt_count")
    .eq("student_id", args.studentId)
    .eq("unit_id", args.unitId)
    .maybeSingle<{ mastery_score: number | null; solved_count: number | null; attempt_count: number | null }>();
  if (existingRes.error && !isMissingColumnError(existingRes.error)) throw existingRes.error;

  const currentAttemptCount = existingRes.data?.attempt_count ?? 0;
  const currentSolvedCount = existingRes.data?.solved_count ?? 0;
  const currentMastery = Number(existingRes.data?.mastery_score ?? 0);
  const nextAttemptCount = currentAttemptCount + 1;
  const nextSolvedCount = currentSolvedCount + (args.accuracy >= 0.8 ? 1 : 0);
  const nextMastery = roundRatio(((currentMastery * currentAttemptCount) + args.accuracy) / nextAttemptCount);
  const recentSpeed = args.durationSec && args.gradableSteps > 0 ? roundRatio(args.durationSec / args.gradableSteps) : null;
  const confidenceLevel = args.accuracy >= 0.8 ? "high" : args.accuracy >= 0.5 ? "medium" : "low";

  const primaryPayload = {
    student_id: args.studentId,
    unit_id: args.unitId,
    subject: "math",
    mastery_score: nextMastery,
    solved_count: nextSolvedCount,
    attempt_count: nextAttemptCount,
    last_attempt_at: args.attemptedAt,
    recent_accuracy: roundRatio(args.accuracy),
    recent_speed: recentSpeed,
    confidence_level: confidenceLevel,
  };

  const primaryRes = await supabase.from("student_mastery").upsert(primaryPayload, {
    onConflict: "student_id,unit_id",
  });
  if (!primaryRes.error) return;
  if (!isMissingColumnError(primaryRes.error)) throw primaryRes.error;

  const fallbackRes = await supabase.from("student_mastery").upsert({
    student_id: args.studentId,
    unit_id: args.unitId,
    subject: "math",
    mastery_score: nextMastery,
    solved_count: nextSolvedCount,
    attempt_count: nextAttemptCount,
    last_attempt_at: args.attemptedAt,
  }, {
    onConflict: "student_id,unit_id",
  });
  if (fallbackRes.error) throw fallbackRes.error;
}

function summarizeMathMissionRows(rows: MathMissionSummaryRow[]): Map<string, { missionCount: number; latestMissionCreatedAt: string | null }> {
  const summary = new Map<string, { missionCount: number; latestMissionCreatedAt: string | null }>();

  for (const row of rows) {
    const current = summary.get(row.unit_id) ?? { missionCount: 0, latestMissionCreatedAt: null };
    summary.set(row.unit_id, {
      missionCount: current.missionCount + 1,
      latestMissionCreatedAt:
        !current.latestMissionCreatedAt || row.created_at > current.latestMissionCreatedAt ? row.created_at : current.latestMissionCreatedAt,
    });
  }

  return summary;
}

function buildVisibleGeneratedMissionsQuery(selectClause: string, options?: {
  subject?: "math" | "english";
  missionId?: string;
  unitId?: string;
  unitIds?: string[];
  requireUnitId?: boolean;
  interestTags?: string[];
}) {
  let query = supabase
    .from("generated_missions")
    .select(selectClause)
    .eq("status", "published")
    .eq("is_active", true)
    .not("published_at", "is", null);

  if (options?.subject) {
    query = query.eq("subject", options.subject);
  }
  if (options?.missionId) {
    query = query.eq("id", options.missionId);
  }
  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  }
  if (options?.unitIds && options.unitIds.length > 0) {
    query = query.in("unit_id", options.unitIds);
  }
  if (options?.requireUnitId) {
    query = query.not("unit_id", "is", null);
  }
  if (options?.interestTags && options.interestTags.length > 0) {
    query = query.contains("interest_tags", options.interestTags);
  }

  return query;
}

async function fetchVisibleMissionSummaryRows(unitIds?: string[], subject: "math" | "english" = "math"): Promise<MathMissionSummaryRow[]> {
  let query = buildVisibleGeneratedMissionsQuery("unit_id,created_at", {
    subject,
    requireUnitId: true,
  });

  if (unitIds && unitIds.length > 0) {
    query = query.in("unit_id", unitIds);
  }

  const { data, error } = await query.returns<MathMissionSummaryRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getVisibleMissionCountByUnit(
  unitIds?: string[],
  subject: "math" | "english" = "math"
): Promise<Map<string, VisibleMissionCountSummary>> {
  return summarizeMathMissionRows(await fetchVisibleMissionSummaryRows(unitIds, subject));
}

export async function getVisibleMissionsByUnit(
  unitId: string,
  subject: "math" | "english" = "math"
): Promise<GeneratedMission[]> {
  const { data, error } = await buildVisibleGeneratedMissionsQuery(GENERATED_MISSION_SELECT, {
    subject,
    unitId,
  })
    .order("created_at", { ascending: false })
    .returns<GeneratedMissionRow[]>();
  if (error) throw error;

  return (data ?? []).map(mapGeneratedMissionRow).filter((row): row is GeneratedMission => row !== null);
}

export async function getVisibleMathMissionsByUnit(unitId: string): Promise<GeneratedMission[]> {
  return getVisibleMissionsByUnit(unitId, "math");
}

export async function fetchCurriculumUnits(
  grade?: number,
  subject: "math" | "english" = "math"
): Promise<CurriculumUnit[]> {
  let query = supabase
    .from("curriculum_units")
    .select("id,school_level,grade,unit_key,unit_name,description,concept_summary,display_order,is_active,subject")
    .eq("subject", subject)
    .eq("is_active", true)
    .order("grade", { ascending: true })
    .order("display_order", { ascending: true })
    .order("unit_name", { ascending: true });

  if (typeof grade === "number" && Number.isFinite(grade)) {
    query = query.eq("grade", grade);
  }

  const { data, error } = await query.returns<Array<CurriculumUnit & { subject?: string }>>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    school_level: row.school_level,
    grade: row.grade,
    unit_key: row.unit_key,
    unit_name: row.unit_name,
    description: row.description,
    concept_summary: row.concept_summary,
    display_order: row.display_order,
    is_active: row.is_active,
  }));
}

export async function fetchCurriculumUnitsBySubject(subject: "math" | "english"): Promise<CurriculumUnit[]> {
  return fetchCurriculumUnits(undefined, subject);
}

function unitCardSort(a: CurriculumUnit, b: CurriculumUnit): number {
  if (a.grade !== b.grade) return a.grade - b.grade;
  if (a.display_order !== b.display_order) return a.display_order - b.display_order;
  return a.unit_name.localeCompare(b.unit_name, "ko");
}

export async function fetchMathHomeGradeUnits(
  grade: number,
  schoolLevel?: string
): Promise<MathHomeUnitCard[]> {
  let query = supabase
    .from("curriculum_units")
    .select(
      "id, school_level, grade, unit_key, unit_name, description, concept_summary, display_order, is_active, subject"
    )
    .eq("subject", "math")
    .eq("is_active", true)
    .eq("grade", grade)
    .order("display_order", { ascending: true })
    .order("unit_name", { ascending: true });

  if (schoolLevel) {
    query = query.eq("school_level", schoolLevel);
  }

  const { data, error } = await query;
  if (error) throw error;

  const units = (data ?? []) as CurriculumUnit[];
  if (units.length === 0) return [];

  const summaryByUnit = await getVisibleMissionCountByUnit(units.map((unit) => unit.id), "math");
  return [...units]
    .sort(unitCardSort)
    .map((unit) => {
      const summary = summaryByUnit.get(unit.id);
      return {
        ...unit,
        missionCount: summary?.missionCount ?? 0,
        latestMissionCreatedAt: summary?.latestMissionCreatedAt ?? null,
      } satisfies MathHomeUnitCard;
    });
}

export async function fetchMathHomeFreshUnits(limit = 4): Promise<MathHomeUnitCard[]> {
  const units = (await fetchCurriculumUnits(undefined, "math")).filter((unit) => unit.school_level !== "high");
  if (units.length === 0) return [];

  const summaryByUnit = await getVisibleMissionCountByUnit(units.map((unit) => unit.id), "math");
  return units
    .map((unit) => {
      const summary = summaryByUnit.get(unit.id);
      return {
        ...unit,
        missionCount: summary?.missionCount ?? 0,
        latestMissionCreatedAt: summary?.latestMissionCreatedAt ?? null,
      } satisfies MathHomeUnitCard;
    })
    .filter((unit) => unit.latestMissionCreatedAt !== null)
    .sort((a, b) => {
      if (a.latestMissionCreatedAt !== b.latestMissionCreatedAt) {
        return (b.latestMissionCreatedAt ?? "").localeCompare(a.latestMissionCreatedAt ?? "");
      }
      return unitCardSort(a, b);
    })
    .slice(0, limit);
}

export async function fetchMathCareerMissions(limit = 12): Promise<GeneratedMission[]> {
  const { data, error } = await buildVisibleGeneratedMissionsQuery(GENERATED_MISSION_SELECT, {
    subject: "math",
    interestTags: ["job"],
  })
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<GeneratedMissionRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapGeneratedMissionRow).filter((row): row is GeneratedMission => row !== null);
}

export async function fetchMissionsByCategory(
  category: string | null,
  subject: "math" | "english" = "math",
  limit = 6
): Promise<GeneratedMission[]> {
  let query = supabase
    .from("v_missions_by_category")
    .select(GENERATED_MISSION_SELECT)
    .eq("subject", subject)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (category !== null) {
    query = query.eq("main_category", category);
  } else {
    query = query.neq("main_category", "other");
  }

  const { data, error } = await query.returns<GeneratedMissionRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapGeneratedMissionRow).filter((row): row is GeneratedMission => row !== null);
}

export async function fetchPublishedMissionsByUnit(unitId: string, subject: "math" | "english" = "math"): Promise<GeneratedMission[]> {
  const rawRows = await getVisibleMissionsByUnit(unitId, subject);
  const parsedRows = rawRows.map((row) => ({
    id: row.id,
    title: row.title,
    reason: null,
    mission: row,
  }));
  const missions = parsedRows
    .map((row) => row.mission)
    .filter((row): row is GeneratedMission => row !== null);

  if (unitId === "0a1966ad-57ff-45b2-8366-ce887104938c") {
    console.info("[fetchPublishedMissionsByUnit]", {
      unitId,
      rawRowCount: rawRows.length,
      finalMissionCount: missions.length,
      droppedRows: parsedRows
        .filter((row) => row.reason)
        .map((row) => ({ id: row.id, title: row.title, reason: row.reason })),
    });
  }

  return missions;
}

export async function fetchPublishedMissions(limit = 24, subject: "math" | "english" = "math"): Promise<GeneratedMission[]> {
  const { data, error } = await buildVisibleGeneratedMissionsQuery(GENERATED_MISSION_SELECT, {
    subject,
  })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<GeneratedMissionRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapGeneratedMissionRow).filter((row): row is GeneratedMission => row !== null);
}

export async function fetchPublishedWeekendMissions(
  subject: "weekend_creative" | "weekend_character",
  limit = 20
): Promise<GeneratedMission[]> {
  const { data, error } = await supabase
    .from("generated_missions")
    .select(GENERATED_MISSION_SELECT)
    .eq("subject", subject)
    .eq("status", "published")
    .eq("is_active", true)
    .not("published_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<GeneratedMissionRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapGeneratedMissionRow).filter((row): row is GeneratedMission => row !== null);
}

export async function fetchMissionById(missionId: string): Promise<GeneratedMission | null> {
  const { data, error } = await buildVisibleGeneratedMissionsQuery(GENERATED_MISSION_SELECT, {
    missionId,
  })
    .maybeSingle<GeneratedMissionRow>();
  if (error) throw error;
  if (!data) return null;
  const mapped = mapGeneratedMissionRow(data);
  if (!mapped) {
    console.warn("[missions] fetchMissionById payload normalization failed", {
      missionId,
      subject: data.subject,
      title: data.title,
      status: data.status,
      isActive: data.is_active,
      publishedAt: data.published_at,
    });
  }
  return mapped;
}

export async function fetchAnyMissionById(missionId: string): Promise<GeneratedMission | null> {
  const { data, error } = await supabase
    .from("generated_missions")
    .select(GENERATED_MISSION_SELECT)
    .eq("id", missionId)
    .maybeSingle<GeneratedMissionRow>();
  if (error) throw error;
  if (!data) return null;
  const mapped = mapGeneratedMissionRow(data);
  if (!mapped) {
    console.warn("[missions] fetchAnyMissionById payload normalization failed", {
      missionId,
      subject: data.subject,
      title: data.title,
      status: data.status,
      isActive: data.is_active,
    });
  }
  return mapped;
}

export async function getPublishedMissionById(
  subject: "math" | "english",
  missionId: string
): Promise<GeneratedMission | null> {
  const { data, error } = await buildVisibleGeneratedMissionsQuery(GENERATED_MISSION_SELECT, {
    subject,
    missionId,
  }).maybeSingle<GeneratedMissionRow>();
  if (error) throw error;
  if (!data) return null;
  const mapped = mapGeneratedMissionRow(data);
  if (!mapped) {
    console.warn("[missions] getPublishedMissionById payload normalization failed", {
      missionId,
      subject,
      title: data.title,
      status: data.status,
      isActive: data.is_active,
      publishedAt: data.published_at,
    });
  }
  return mapped;
}

function missionAttemptSelectColumns(): string {
  return "id,student_id,mission_id,subject,unit_id,status,total_steps,correct_steps,score,duration_sec,xp_earned,started_at,completed_at,created_at,updated_at";
}

async function insertMissionAttemptWithFallback(args: {
  studentId: string;
  missionId: string;
}): Promise<MissionAttempt> {
  const mission = await fetchMissionById(args.missionId);
  const missionJson = mission?.mission_json as ({ activities?: unknown[]; steps?: unknown[] }) | undefined;
  const totalSteps = missionJson?.activities?.length ?? missionJson?.steps?.length ?? getSeedMissionStepCount(args.missionId);
  const attemptPayload = {
    student_id: args.studentId,
    mission_id: args.missionId,
    subject: mission?.subject ?? null,
    unit_id: mission?.unit_id ?? null,
    status: "started",
    total_steps: totalSteps,
    xp_earned: 0,
  };

  const modernRes = await supabase
    .from("mission_attempts")
    .insert(attemptPayload)
    .select(missionAttemptSelectColumns())
    .single<MissionAttempt>();
  if (!modernRes.error) return modernRes.data;
  if (!isMissingColumnError(modernRes.error)) throw modernRes.error;

  const legacyRes = await supabase
    .from("mission_attempts")
    .insert({
      student_id: args.studentId,
      mission_id: args.missionId,
      status: "started",
      total_steps: totalSteps,
    })
    .select("id,student_id,mission_id,status,total_steps,correct_steps,score,duration_sec,started_at,completed_at,created_at,updated_at")
    .single<MissionAttempt>();
  if (legacyRes.error) throw legacyRes.error;

  return {
    ...legacyRes.data,
    subject: mission?.subject ?? null,
    unit_id: mission?.unit_id ?? null,
    xp_earned: 0,
  };
}

function parseLegacyActivityStep(value: unknown, index: number): MissionStep | null {
  if (!isObject(value)) return null;

  const [strHint1, strHint2, strHint3] = extractStringHints(value.hints);
  const rawType = asString(value.type);
  const prompt = asString(value.prompt);
  const explanation = asString(value.explanation);
  const title = asString(value.title) ?? prompt ?? explanation ?? `Step ${index + 1}`;
  const answerType = asString(value.answerType) ?? asString(value.answer_type);
  const acceptedAnswers = asStringArray(value.acceptedAnswers) ?? asStringArray(value.accepted_answers);
  const options = Array.isArray(value.options)
    ? value.options.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const answerIndexes = Array.isArray(value.answers)
    ? value.answers.filter((item): item is number => typeof item === "number" && Number.isFinite(item)).map((item) => Math.max(0, Math.round(item)))
    : Array.isArray(value.answer)
      ? value.answer.filter((item): item is number => typeof item === "number" && Number.isFinite(item)).map((item) => Math.max(0, Math.round(item)))
      : [];
  const writingGuide = Array.isArray(value.writingGuide)
    ? value.writingGuide.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : Array.isArray(value.writing_guide)
      ? value.writing_guide.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : Array.isArray(value.guide)
        ? value.guide.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : undefined;
  const keyExpressions = Array.isArray(value.keyExpressions)
    ? value.keyExpressions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : Array.isArray(value.key_expressions)
      ? value.key_expressions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined;
  const commonMistakes = Array.isArray(value.commonMistakes)
    ? value.commonMistakes.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : Array.isArray(value.common_mistakes)
      ? value.common_mistakes.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined;
  const expectedSentenceCountRaw = value.expectedSentenceCount ?? value.expected_sentence_count;
  const expectedSentenceCount =
    typeof expectedSentenceCountRaw === "number" && Number.isFinite(expectedSentenceCountRaw)
      ? Math.max(1, Math.round(expectedSentenceCountRaw))
      : undefined;

  if (rawType === "choice" || rawType === "multiple_choice") {
    const rawAnswer = value.answer;
    const numericIndex = typeof rawAnswer === "number" && Number.isFinite(rawAnswer)
      ? rawAnswer
      : typeof rawAnswer === "string" && /^\d+$/.test(rawAnswer.trim())
        ? parseInt(rawAnswer.trim(), 10)
        : null;
    const correctAnswer =
      numericIndex !== null && options && options[numericIndex] != null
        ? options[numericIndex]
        : asStringOrNumber(rawAnswer);

    return {
      stepOrder: index + 1,
      title,
      stepType: "choice",
      question: prompt ?? undefined,
      explanation: explanation ?? undefined,
      choices: options,
      correctAnswer: correctAnswer ?? undefined,
      acceptedAnswers,
      hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? strHint1 ?? undefined,
      hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? strHint2 ?? undefined,
      hintLevel3: asString(value.hintLevel3) ?? asString(value.hint_level3) ?? strHint3 ?? undefined,
      hints: parseMissionHints(value.hints),
      solution: parseMissionSolution(value.solution),
    };
  }

  if (rawType === "multi_select") {
    return {
      stepOrder: index + 1,
      title,
      stepType: "multi_select",
      question: prompt ?? undefined,
      explanation: explanation ?? undefined,
      choices: options,
      correctChoiceIndexes: answerIndexes.length > 0 ? Array.from(new Set(answerIndexes)) : undefined,
      acceptedAnswers,
      hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? strHint1 ?? undefined,
      hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? strHint2 ?? undefined,
      hintLevel3: asString(value.hintLevel3) ?? asString(value.hint_level3) ?? strHint3 ?? undefined,
      hints: parseMissionHints(value.hints),
      solution: parseMissionSolution(value.solution),
    };
  }

  if (rawType === "short_answer" || rawType === "input") {
    return {
      stepOrder: index + 1,
      title,
      stepType: "input",
      question: prompt ?? undefined,
      explanation: explanation ?? undefined,
      answerType: answerType === "number" || answerType === "equation" ? answerType : "text",
      correctAnswer: asStringOrNumber(value.answer) ?? undefined,
      acceptedAnswers,
      inputPlaceholder: asString(value.placeholder) ?? undefined,
      hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? strHint1 ?? undefined,
      hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? strHint2 ?? undefined,
      hintLevel3: asString(value.hintLevel3) ?? asString(value.hint_level3) ?? strHint3 ?? undefined,
      hints: parseMissionHints(value.hints),
      solution: parseMissionSolution(value.solution),
    };
  }

  if (
    rawType === "writing" ||
    rawType === "free_response" ||
    rawType === "paragraph" ||
    rawType === "paragraph_response" ||
    rawType === "scenario_response"
  ) {
    return {
      stepOrder: index + 1,
      title,
      stepType: "writing",
      question: prompt ?? undefined,
      explanation: explanation ?? undefined,
      answerType: "writing",
      inputPlaceholder: asString(value.placeholder) ?? asString(value.inputPlaceholder) ?? undefined,
      expectedSentenceCount,
      writingGuide,
      sampleAnswer: asString(value.sampleAnswer) ?? asString(value.sample_answer) ?? undefined,
      keyExpressions,
      commonMistakes,
      hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? strHint1 ?? undefined,
      hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? strHint2 ?? undefined,
      hintLevel3: asString(value.hintLevel3) ?? asString(value.hint_level3) ?? strHint3 ?? undefined,
      hints: parseMissionHints(value.hints),
      solution: parseMissionSolution(value.solution),
      feedbackCorrect: asString(value.feedbackCorrect) ?? asString(value.feedback_correct) ?? undefined,
      feedbackIncorrect: asString(value.feedbackIncorrect) ?? asString(value.feedback_incorrect) ?? undefined,
    };
  }

  if (rawType === "concept") {
    const guide = writingGuide?.join("\n") ?? "";
    return {
      stepOrder: index + 1,
      title,
      stepType: "concept",
      question: prompt ?? undefined,
      explanation: [explanation, guide].filter(Boolean).join("\n") || undefined,
      conceptTitle: title,
      conceptDescription: [prompt, guide].filter(Boolean).join("\n") || undefined,
      hints: parseMissionHints(value.hints),
      solution: parseMissionSolution(value.solution),
    };
  }

  return {
    stepOrder: index + 1,
    title,
    stepType: "intro",
    question: prompt ?? undefined,
    explanation: explanation ?? undefined,
    hints: parseMissionHints(value.hints),
    solution: parseMissionSolution(value.solution),
  };
}

export async function startMissionAttempt(studentId: string, missionId: string): Promise<MissionAttempt> {
  return insertMissionAttemptWithFallback({ studentId, missionId });
}

export async function createMissionAttempt(missionId: string): Promise<MissionAttempt> {
  const me = await getCurrentStudentIdentity();
  return insertMissionAttemptWithFallback({ studentId: me.id, missionId });
}

export async function getOrCreateActiveMissionAttempt(missionId: string): Promise<MissionAttempt> {
  const me = await getCurrentStudentIdentity();
  const attemptColumns = missionAttemptSelectColumns();

  const activeAttemptRes = await supabase
    .from("mission_attempts")
    .select(attemptColumns)
    .eq("student_id", me.id)
    .eq("mission_id", missionId)
    .eq("status", "started")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<MissionAttempt>();

  if (activeAttemptRes.error && !isMissingColumnError(activeAttemptRes.error)) throw activeAttemptRes.error;
  if (activeAttemptRes.data) return activeAttemptRes.data;

  if (activeAttemptRes.error && isMissingColumnError(activeAttemptRes.error)) {
    const legacyAttemptRes = await supabase
      .from("mission_attempts")
      .select("id,student_id,mission_id,status,total_steps,correct_steps,score,duration_sec,started_at,completed_at,created_at,updated_at")
      .eq("student_id", me.id)
      .eq("mission_id", missionId)
      .eq("status", "started")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<MissionAttempt>();
    if (legacyAttemptRes.error) throw legacyAttemptRes.error;
    if (legacyAttemptRes.data) {
      const mission = await fetchMissionById(missionId);
      return {
        ...legacyAttemptRes.data,
        subject: mission?.subject ?? null,
        unit_id: mission?.unit_id ?? null,
        xp_earned: legacyAttemptRes.data.xp_earned ?? 0,
      };
    }
  }

  return createMissionAttempt(missionId);
}

export async function saveMissionStepAttempt(payload: LegacyMissionStepSavePayload): Promise<void> {
  await saveMissionStepResult({
    attemptId: payload.attemptId,
    missionId: payload.missionId,
    stepOrder: payload.stepOrder,
    studentAnswer: payload.answerText ?? null,
    isCorrect: payload.isCorrect,
    hintUsed: false,
    timeSpentSeconds: payload.elapsedMs ? Math.round(payload.elapsedMs / 1000) : null,
  });
}

export async function saveMissionStepResult(payload: MissionStepResultPayload): Promise<void> {
  const me = await getCurrentStudentIdentity();
  const normalizedAnswer = typeof payload.studentAnswer === "string" ? payload.studentAnswer.trim() : "";

  if (!payload.missionId) {
    throw new Error("missionId is required to save a mission step result.");
  }
  if (!normalizedAnswer) {
    return;
  }
  if (payload.isCorrect === null) {
    return;
  }

  console.info("[saveMissionStepResult] payload", {
    missionId: payload.missionId,
    attemptId: payload.attemptId,
    studentId: me.id,
    stepOrder: payload.stepOrder,
    studentAnswer: normalizedAnswer,
    isCorrect: payload.isCorrect,
    hintUsed: payload.hintUsed,
  });

  const { data: existingStepAttempt, error: existingStepAttemptError } = await supabase
    .from("mission_step_attempts")
    .select("id")
    .eq("attempt_id", payload.attemptId)
    .eq("step_order", payload.stepOrder)
    .maybeSingle<{ id: string }>();
  if (existingStepAttemptError) throw existingStepAttemptError;

  if (existingStepAttempt) {
    const { error: updateError } = await supabase
      .from("mission_step_attempts")
      .update({
        student_answer: normalizedAnswer,
        is_correct: payload.isCorrect,
        hint_used: payload.hintUsed,
        answered_at: new Date().toISOString(),
        student_id: me.id,
      })
      .eq("attempt_id", payload.attemptId)
      .eq("step_order", payload.stepOrder);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase.from("mission_step_attempts").insert({
    attempt_id: payload.attemptId,
    step_order: payload.stepOrder,
    student_answer: normalizedAnswer,
    is_correct: payload.isCorrect,
    hint_used: payload.hintUsed,
    answered_at: new Date().toISOString(),
    student_id: me.id,
  });
  if (insertError) throw insertError;
}
export async function completeMissionAttemptMinimal(attemptId: string): Promise<void> {
  const me = await getCurrentStudentIdentity();
  const nowIso = new Date().toISOString();

  const updateRes = await supabase
    .from("mission_attempts")
    .update({
      status: "completed",
      completed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", attemptId)
    .eq("student_id", me.id);
  if (updateRes.error) throw updateRes.error;
}

export async function completeMissionAttempt(payload: CompleteMissionAttemptPayload): Promise<void> {
  const me = await getCurrentStudentIdentity();
  const now = new Date();
  const nowIso = now.toISOString();
  const safeTotal = payload.totalSteps > 0 ? payload.totalSteps : 1;
  const accuracy = payload.correctSteps / safeTotal;
  const score = Math.round(accuracy * 100);

  const startedRes = await supabase
    .from("mission_attempts")
    .select("started_at")
    .eq("id", payload.attemptId)
    .eq("student_id", me.id)
    .maybeSingle<{ started_at: string }>();
  if (startedRes.error) throw startedRes.error;

  const durationSec = getAttemptDurationSeconds(startedRes.data?.started_at, now);

  const { error } = await supabase
    .from("mission_attempts")
    .update({
      status: "completed",
      completed_at: nowIso,
      score,
      duration_sec: durationSec,
      total_steps: payload.totalSteps,
      correct_steps: payload.correctSteps,
      updated_at: nowIso,
    })
    .eq("id", payload.attemptId)
    .eq("student_id", me.id);
  if (error) throw error;
}

type ProcessMissionCompleteResult = {
  xp_earned: number;
  total_xp: number;
  level: number;
  prev_level: number;
  leveled_up: boolean;
  xp_to_next: number;
  new_badges: Array<{
    key: string;
    title: string;
    description: string;
    iconUrl: string | null;
    subject: string;
    earnedAt: string;
  }>;
  streak: number;
  // 힌트 차감 정보 (RPC가 새로 반환). 옛 응답엔 없을 수 있어 optional.
  base_xp?: number | null;
  bonus_xp?: number | null;
  hint_used_count?: number | null;
  hint_penalty?: number | null;
  hint_penalty_pct?: number | null;
};

export async function completeMissionAttemptWithFeedback(args: {
  attemptId: string;
  missionId: string;
  unitId: string | null;
  steps: MissionStep[];
  hintUsedCount?: number;
}): Promise<MissionCompletionFeedback> {
  const me = await getCurrentStudentIdentity();
  const mission = await fetchMissionById(args.missionId);

  const { data: stepAttempts, error: stepAttemptsError } = await supabase
    .from("mission_step_attempts")
    .select("step_order,student_answer,is_correct,hint_used,answered_at,student_id")
    .eq("attempt_id", args.attemptId)
    .returns<MissionStepAttemptSummaryRow[]>();
  if (stepAttemptsError) {
    console.error("completeMissionAttemptWithFeedback step failed", { stage: "load_step_attempts", error: stepAttemptsError });
    throw stepAttemptsError;
  }

  const stepAttemptMap = new Map((stepAttempts ?? []).map((row) => [row.step_order, row]));
  const gradableSteps = args.steps.filter(isGradableMissionStep);
  const correctSteps = gradableSteps.reduce((count, step) => count + (stepAttemptMap.get(step.stepOrder)?.is_correct === true ? 1 : 0), 0);
  const accuracy = gradableSteps.length > 0 ? correctSteps / gradableSteps.length : 1;
  const storedHintUsedCount = (stepAttempts ?? []).reduce((count, row) => count + (row.hint_used ? 1 : 0), 0);
  const hintUsedCount = Math.max(storedHintUsedCount, args.hintUsedCount ?? 0);

  const incorrectStepSummaries = gradableSteps
    .filter((step) => stepAttemptMap.get(step.stepOrder)?.is_correct === false)
    .map((step) => ({
      stepOrder: step.stepOrder,
      title: step.title,
      summary: displayInlineTextForFeedback(step.feedbackIncorrect ?? step.explanation ?? step.question ?? step.title),
    }))
    .slice(0, 3);

  const score = Math.round(accuracy * 100);
  const subject = mission?.subject ?? "math";
  const difficulty = mission?.difficulty ?? "normal";
  const unitId = mission?.unit_id ?? args.unitId ?? null;

  // 재도전 감지: 같은 학생이 이 미션을 이전에 완료한 적이 있다면 XP 재지급 차단.
  // DB의 student_xp_log UNIQUE INDEX(student_id, mission_id) WHERE reason='mission_complete'
  // 와 동일한 의도로, 첫 완료된 mission_attempts를 단일 진실 소스로 사용한다.
  const priorRes = await supabase
    .from("mission_attempts")
    .select("id, completed_at, xp_earned")
    .eq("student_id", me.id)
    .eq("mission_id", args.missionId)
    .eq("status", "completed")
    .neq("id", args.attemptId)
    .order("completed_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; completed_at: string | null; xp_earned: number | null }>();
  if (priorRes.error) {
    console.error("completeMissionAttemptWithFeedback step failed", { stage: "prior_lookup", error: priorRes.error });
    throw priorRes.error;
  }

  if (priorRes.data) {
    // 연습 모드: 현재 시도는 이력 보존을 위해 'completed'로 마감만 하고 XP는 지급하지 않는다.
    await completeMissionAttempt({
      attemptId: args.attemptId,
      correctSteps,
      totalSteps: args.steps.length,
    });
    const practiceFeedback = buildMissionCompletionFeedback({
      accuracy: roundRatio(accuracy),
      correctSteps,
      totalSteps: args.steps.length,
      gradableSteps: gradableSteps.length,
      hintUsedCount,
      earnedXp: 0,
      incorrectStepSummaries,
      isPractice: true,
      firstClearedAt: priorRes.data.completed_at,
    });
    return {
      ...practiceFeedback,
      newlyEarnedBadges: [],
      level: 0,
      prevLevel: 0,
      leveledUp: false,
      xpToNextLevel: 0,
      totalXp: 0,
      streak: 0,
    };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("process_mission_complete", {
    p_student_id:      me.id,
    p_attempt_id:      args.attemptId,
    p_mission_id:      args.missionId,
    p_subject:         subject,
    p_difficulty:      difficulty,
    p_score:           score,
    p_correct_steps:   correctSteps,
    p_total_steps:     args.steps.length,
    p_hint_used_count: hintUsedCount,
    p_unit_id:         unitId,
  }).returns<ProcessMissionCompleteResult>();

  if (rpcError) {
    // 동시 요청으로 인한 race: DB UNIQUE 제약이 23505로 거부한 경우 연습 모드로 안전 폴백.
    if ((rpcError as { code?: string }).code === "23505") {
      const racePriorRes = await supabase
        .from("mission_attempts")
        .select("completed_at")
        .eq("student_id", me.id)
        .eq("mission_id", args.missionId)
        .eq("status", "completed")
        .neq("id", args.attemptId)
        .order("completed_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ completed_at: string | null }>();
      const fallback = buildMissionCompletionFeedback({
        accuracy: roundRatio(accuracy),
        correctSteps,
        totalSteps: args.steps.length,
        gradableSteps: gradableSteps.length,
        hintUsedCount,
        earnedXp: 0,
        incorrectStepSummaries,
        isPractice: true,
        firstClearedAt: racePriorRes.data?.completed_at ?? null,
      });
      return {
        ...fallback,
        newlyEarnedBadges: [],
        level: 0,
        prevLevel: 0,
        leveledUp: false,
        xpToNextLevel: 0,
        totalXp: 0,
        streak: 0,
      };
    }
    console.error("completeMissionAttemptWithFeedback step failed", { stage: "rpc", error: rpcError });
    throw rpcError;
  }

  const result = rpcData as ProcessMissionCompleteResult;
  const newlyEarnedBadges: EarnedBadgeSummary[] = (result.new_badges ?? []).map((b) => ({
    key: b.key as EarnedBadgeSummary["key"],
    subject: b.subject as EarnedBadgeSummary["subject"],
    title: b.title,
    name: b.title,
    description: b.description,
    category: "" as EarnedBadgeSummary["category"],
    iconUrl: b.iconUrl ?? "",
    conditionType: "" as EarnedBadgeSummary["conditionType"],
    conditionValue: 0,
    isActive: true,
    badgeId: null,
    earnedAt: b.earnedAt,
    relatedMissionId: args.missionId,
    progressValue: 0,
    targetValue: 0,
    progressPercent: 100,
    state: "earned" as const,
  }));

  const earnedXp = result.xp_earned ?? 0;
  const rpcHintCount = typeof result.hint_used_count === "number" ? result.hint_used_count : hintUsedCount;
  const feedback = buildMissionCompletionFeedback({
    accuracy: roundRatio(accuracy),
    correctSteps,
    totalSteps: args.steps.length,
    gradableSteps: gradableSteps.length,
    hintUsedCount: rpcHintCount,
    earnedXp,
    incorrectStepSummaries,
    baseXp: result.base_xp ?? earnedXp,
    bonusXp: result.bonus_xp ?? 0,
    hintPenaltyPct: result.hint_penalty_pct ?? 0,
  });

  return {
    ...feedback,
    newlyEarnedBadges,
    level: result.level ?? 1,
    prevLevel: result.prev_level ?? 1,
    leveledUp: result.leveled_up ?? false,
    xpToNextLevel: result.xp_to_next ?? 0,
    totalXp: result.total_xp ?? 0,
    streak: result.streak ?? 0,
  };
}
function displayInlineTextForFeedback(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\r\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export async function getTodayCompletedMissionIds(): Promise<string[]> {
  const me = await getCurrentStudentIdentity();
  const { startIso, endIso } = getKstDayBounds();
  const { data, error } = await supabase
    .from("mission_attempts")
    .select("mission_id")
    .eq("student_id", me.id)
    .eq("status", "completed")
    .gte("completed_at", startIso)
    .lt("completed_at", endIso)
    .returns<Array<{ mission_id: string }>>();
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.mission_id)));
}

// level_definitions에서 특정 레벨에 매핑된 캐릭터 키를 가져온다.
// DB에 row가 없거나 컬럼이 비어 있으면 null. 호출부에서 fallback 처리.
export async function getLevelCharacterKey(level: number): Promise<string | null> {
  if (!Number.isFinite(level) || level <= 0) return null;
  const { data, error } = await supabase
    .from("level_definitions")
    .select("character_key")
    .eq("level", Math.floor(level))
    .maybeSingle<{ character_key: string | null }>();
  if (error) {
    console.warn("getLevelCharacterKey failed", error);
    return null;
  }
  return data?.character_key ?? null;
}

// 미션 완료 결과(점수 + 힌트 사용)에 맞춰 캐릭터 키와 응원 메시지를 고른다.
// 화면에서는 Character 컴포넌트로 렌더한다.
export function pickCompletionCharacter(args: {
  accuracy: number;
  hintUsedCount: number;
  isPractice?: boolean;
}): { key: string; message: string } {
  if (args.isPractice) {
    return { key: "mv_reading", message: "연습 완료! 꾸준한 노력이 중요해요 📚" };
  }
  const score = Math.round(args.accuracy * 100);
  if (score >= 100 && args.hintUsedCount === 0) {
    return { key: "mv_touched", message: "완벽해요! 정말 대단합니다 ✨" };
  }
  if (score >= 100) {
    return { key: "mv_excited", message: "잘했어요! 다음엔 힌트 없이도 도전!" };
  }
  if (score >= 80) {
    return { key: "mv_wink", message: "잘 풀었어요! 조금만 더 힘내요" };
  }
  if (score >= 50) {
    return { key: "mv_cheer", message: "괜찮아요! 다시 도전하면 돼요" };
  }
  return { key: "mv_comfort", message: "힘들었죠? 한 단계씩 천천히 해봐요" };
}

// 학생이 특정 미션을 이전에 완료한 적 있는지(=재도전 시 XP 미지급) 확인.
// 존재하면 첫 완료 시각을 함께 반환한다.
export async function getMissionFirstClearForStudent(
  missionId: string
): Promise<{ firstClearedAt: string | null } | null> {
  if (!missionId) return null;
  const me = await getCurrentStudentIdentity();
  const { data, error } = await supabase
    .from("mission_attempts")
    .select("completed_at")
    .eq("student_id", me.id)
    .eq("mission_id", missionId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ completed_at: string | null }>();
  if (error) throw error;
  if (!data) return null;
  return { firstClearedAt: data.completed_at };
}

export function calculateStreak(completedDates: string[]): number {
  const uniqueSorted = Array.from(
    new Set(
      completedDates
        .map((date) => date.trim())
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    )
  ).sort((a, b) => b.localeCompare(a));
  if (uniqueSorted.length === 0) return 0;

  const todayKey = toKstDateKey(new Date());
  let cursor = todayKey;
  let streak = 0;

  while (uniqueSorted.includes(cursor)) {
    streak += 1;
    const base = new Date(`${cursor}T00:00:00+09:00`);
    base.setUTCDate(base.getUTCDate() - 1);
    cursor = toKstDateKey(base);
  }

  return streak;
}

async function filterMissionAttemptRowsBySubject<
  TRow extends {
    mission_id: string;
  },
>(rows: TRow[], subject?: "math" | "english"): Promise<TRow[]> {
  if (!subject || rows.length === 0) return rows;

  const missionIds = Array.from(new Set(rows.map((row) => row.mission_id)));
  if (missionIds.length === 0) return [];

  const missionsRes = await supabase
    .from("generated_missions")
    .select("id")
    .eq("subject", subject)
    .in("id", missionIds)
    .returns<Array<Pick<GeneratedMission, "id">>>();
  if (missionsRes.error) throw missionsRes.error;

  const allowedMissionIds = new Set((missionsRes.data ?? []).map((row) => row.id));
  return rows.filter((row) => allowedMissionIds.has(row.mission_id));
}

export async function getStudentMissionStats(subject?: "math" | "english"): Promise<StudentMissionStats> {
  const me = await getCurrentStudentIdentity();
  const { data, error } = await supabase
    .from("mission_attempts")
    .select("mission_id,completed_at,status")
    .eq("student_id", me.id)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .returns<Array<{ mission_id: string; completed_at: string; status: "completed" }>>();
  if (error) throw error;

  const rows = await filterMissionAttemptRowsBySubject(data ?? [], subject);
  const completedMissionIds = new Set<string>();
  const completedDates: string[] = [];
  let lastCompletedAt: string | null = null;

  for (const row of rows) {
    completedMissionIds.add(row.mission_id);
    const key = toKstDateKey(row.completed_at);
    if (key) completedDates.push(key);
    if (!lastCompletedAt || row.completed_at > lastCompletedAt) {
      lastCompletedAt = row.completed_at;
    }
  }

  const { dateKey: todayKey } = getKstDayBounds();
  const { startIso: weekStartIso, endIso: weekEndIso } = getKstWeekBounds();
  const todayCompletedCount = new Set(
    rows.filter((row) => toKstDateKey(row.completed_at) === todayKey).map((row) => row.mission_id)
  ).size;
  const weeklyCompletedCount = new Set(
    rows
      .filter((row) => row.completed_at >= weekStartIso && row.completed_at < weekEndIso)
      .map((row) => row.mission_id)
  ).size;

  return {
    totalCompletedMissions: completedMissionIds.size,
    todayCompletedCount,
    weeklyCompletedCount,
    lastCompletedAt,
    completedDates: Array.from(new Set(completedDates)),
  };
}

function xpForMissionDifficulty(difficulty: GeneratedMission["difficulty"]): number {
  if (difficulty === "challenge" || difficulty === "hard") return 15;
  return 10;
}

export async function getStudentXpSummary(subject?: "math" | "english"): Promise<StudentXpSummary> {
  const LEVEL_THRESHOLDS = [
    { level: 1,  min: 0,    max: 200   },
    { level: 2,  min: 200,  max: 450   },
    { level: 3,  min: 450,  max: 800   },
    { level: 4,  min: 800,  max: 1300  },
    { level: 5,  min: 1300, max: 2000  },
    { level: 6,  min: 2000, max: 3000  },
    { level: 7,  min: 3000, max: 4500  },
    { level: 8,  min: 4500, max: 6500  },
    { level: 9,  min: 6500, max: 9000  },
    { level: 10, min: 9000, max: 99999 },
  ] as const;
  const me = await getCurrentStudentIdentity();
  const modernAttemptsRes = await supabase
    .from("mission_attempts")
    .select("mission_id,subject,xp_earned")
    .eq("student_id", me.id)
    .eq("status", "completed")
    .returns<Array<{ mission_id: string; subject: string | null; xp_earned: number | null }>>();

  if (!modernAttemptsRes.error) {
    const attempts = (modernAttemptsRes.data ?? []).filter((row) => !subject || row.subject === subject);
    const unresolvedMissionIds = attempts.filter((row) => row.xp_earned === null || row.xp_earned === 0).map((row) => row.mission_id);
    let fallbackXpByMissionId = new Map<string, number>();

    if (unresolvedMissionIds.length > 0) {
      let missionsQuery = supabase.from("generated_missions").select("id,difficulty,subject").in("id", Array.from(new Set(unresolvedMissionIds)));
      if (subject) {
        missionsQuery = missionsQuery.eq("subject", subject);
      }
      const missionsRes = await missionsQuery.returns<Array<Pick<GeneratedMission, "id" | "difficulty" | "subject">>>();
      if (missionsRes.error) throw missionsRes.error;
      fallbackXpByMissionId = new Map((missionsRes.data ?? []).map((mission) => [mission.id, xpForMissionDifficulty(mission.difficulty)]));
    }

    const totalXp = attempts.reduce((sum, attempt) => sum + (attempt.xp_earned && attempt.xp_earned > 0 ? attempt.xp_earned : (fallbackXpByMissionId.get(attempt.mission_id) ?? 0)), 0);
    const currentLevelDef = [...LEVEL_THRESHOLDS].reverse().find((l) => totalXp >= l.min) ?? LEVEL_THRESHOLDS[0];
    const level = currentLevelDef.level;
    const currentLevelXpFloor = currentLevelDef.min;
    const nextLevelXpTarget = currentLevelDef.max;
    const xpToNextLevel = Math.max(0, nextLevelXpTarget - totalXp);

    return {
      totalXp,
      level,
      currentLevelXpFloor,
      nextLevelXpTarget,
      xpToNextLevel,
    };
  }

  if (!isMissingColumnError(modernAttemptsRes.error)) throw modernAttemptsRes.error;

  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("mission_id")
    .eq("student_id", me.id)
    .eq("status", "completed")
    .returns<Array<{ mission_id: string }>>();
  if (attemptsRes.error) throw attemptsRes.error;

  const filteredAttempts = await filterMissionAttemptRowsBySubject(attemptsRes.data ?? [], subject);
  const missionIds = Array.from(new Set(filteredAttempts.map((row) => row.mission_id)));
  if (missionIds.length === 0) {
    return {
      totalXp: 0,
      level: 1,
      currentLevelXpFloor: 0,
      nextLevelXpTarget: 200,
      xpToNextLevel: 200,
    };
  }

  let missionsQuery = supabase.from("generated_missions").select("id,difficulty").in("id", missionIds);
  if (subject) {
    missionsQuery = missionsQuery.eq("subject", subject);
  }
  const missionsRes = await missionsQuery.returns<Array<Pick<GeneratedMission, "id" | "difficulty">>>();
  if (missionsRes.error) throw missionsRes.error;

  const totalXp = (missionsRes.data ?? []).reduce((sum, mission) => sum + xpForMissionDifficulty(mission.difficulty), 0);
  const currentLevelDef = [...LEVEL_THRESHOLDS].reverse().find((l) => totalXp >= l.min) ?? LEVEL_THRESHOLDS[0];
  const level = currentLevelDef.level;
  const currentLevelXpFloor = currentLevelDef.min;
  const nextLevelXpTarget = currentLevelDef.max;
  const xpToNextLevel = Math.max(0, nextLevelXpTarget - totalXp);

  return {
    totalXp,
    level,
    currentLevelXpFloor,
    nextLevelXpTarget,
    xpToNextLevel,
  };
}

export async function getTodayRecommendedMission(): Promise<TodayRecommendedMission | null> {
  const me = await getCurrentStudentIdentity();
  const missionsRes = await buildVisibleGeneratedMissionsQuery("id,title,estimated_minutes,difficulty", {
    subject: "math",
  })
    .order("difficulty", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Array<TodayRecommendedMission>>();
  if (missionsRes.error) throw missionsRes.error;

  const missions = missionsRes.data ?? [];
  if (missions.length === 0) return null;

  const { startIso, endIso } = getKstDayBounds();
  const [todayAttemptsRes, allCompletedAttemptsRes] = await Promise.all([
    supabase
      .from("mission_attempts")
      .select("mission_id")
      .eq("student_id", me.id)
      .eq("status", "completed")
      .gte("completed_at", startIso)
      .lt("completed_at", endIso)
      .returns<Array<{ mission_id: string }>>(),
    supabase
      .from("mission_attempts")
      .select("mission_id")
      .eq("student_id", me.id)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .returns<Array<{ mission_id: string }>>(),
  ]);
  if (todayAttemptsRes.error) throw todayAttemptsRes.error;
  if (allCompletedAttemptsRes.error) throw allCompletedAttemptsRes.error;

  const todayCompleted = new Set((todayAttemptsRes.data ?? []).map((row) => row.mission_id));
  const completedEver = new Set((allCompletedAttemptsRes.data ?? []).map((row) => row.mission_id));

  const uncompletedRecently = missions.find(
    (mission) => !todayCompleted.has(mission.id) && !completedEver.has(mission.id)
  );
  if (uncompletedRecently) return uncompletedRecently;

  const uncompletedToday = missions.find((mission) => !todayCompleted.has(mission.id));
  if (uncompletedToday) return uncompletedToday;

  const easiest =
    missions.find((mission) => mission.difficulty === "easy") ??
    missions.find((mission) => mission.difficulty === "normal") ??
    missions[0];
  return easiest ?? missions[0];
}

export async function fetchLatestInProgressAttempt(studentId: string): Promise<MissionAttempt | null> {
  const { data, error } = await supabase
    .from("mission_attempts")
    .select("id,student_id,mission_id,status,total_steps,score,duration_sec,started_at,completed_at,created_at,updated_at")
    .eq("student_id", studentId)
    .eq("status", "started")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<MissionAttempt>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMissionProgressMap(
  missionIds: string[],
  totalStepFallback: Record<string, number> = {}
): Promise<Record<string, MissionProgressSummary>> {
  const uniqueMissionIds = Array.from(new Set(missionIds.filter((id) => id.trim().length > 0)));
  if (uniqueMissionIds.length === 0) return {};

  const me = await getCurrentStudentIdentity();
  const attemptColumns =
    "id,student_id,mission_id,status,total_steps,correct_steps,score,duration_sec,started_at,completed_at,created_at,updated_at";
  const attemptsRes = await supabase
    .from("mission_attempts")
    .select(attemptColumns)
    .eq("student_id", me.id)
    .in("mission_id", uniqueMissionIds)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<MissionAttempt[]>();
  if (attemptsRes.error) throw attemptsRes.error;

  const attempts = attemptsRes.data ?? [];
  const selectedAttempts = new Map<string, MissionAttempt>();
  for (const missionId of uniqueMissionIds) {
    const missionAttempts = attempts.filter((attempt) => attempt.mission_id === missionId);
    const latestAttempt = missionAttempts[0];
    if (latestAttempt) selectedAttempts.set(missionId, latestAttempt);
  }

  const attemptIds = Array.from(new Set(Array.from(selectedAttempts.values()).map((attempt) => attempt.id)));
  const stepAttemptMap = new Map<string, number>();
  if (attemptIds.length > 0) {
    const stepAttemptsRes = await supabase
      .from("mission_step_attempts")
      .select("attempt_id,step_order")
      .in("attempt_id", attemptIds)
      .eq("student_id", me.id)
      .returns<Array<{ attempt_id: string; step_order: number }>>();
    if (stepAttemptsRes.error) throw stepAttemptsRes.error;

    for (const row of stepAttemptsRes.data ?? []) {
      const previous = stepAttemptMap.get(row.attempt_id) ?? 0;
      stepAttemptMap.set(row.attempt_id, Math.max(previous, row.step_order));
    }
  }

  const progressMap: Record<string, MissionProgressSummary> = {};
  for (const missionId of uniqueMissionIds) {
    const attempt = selectedAttempts.get(missionId);
    const fallbackTotal = totalStepFallback[missionId] ?? 0;
    if (!attempt) {
      progressMap[missionId] = {
        missionId,
        attemptId: null,
        status: "not_started",
        lastStep: 0,
        totalSteps: fallbackTotal,
      };
      continue;
    }

    const lastStep = stepAttemptMap.get(attempt.id) ?? 0;
    const totalSteps = attempt.total_steps ?? fallbackTotal;
    progressMap[missionId] = {
      missionId,
      attemptId: attempt.id,
      status: attempt.status === "completed" ? "completed" : "in_progress",
      lastStep,
      totalSteps,
    };
  }

  return progressMap;
}

export async function fetchMissionProgress(
  missionId: string,
  totalStepsFallback = 0
): Promise<MissionProgressSummary> {
  const progressMap = await fetchMissionProgressMap([missionId], { [missionId]: totalStepsFallback });
  return (
    progressMap[missionId] ?? {
      missionId,
      attemptId: null,
      status: "not_started",
      lastStep: 0,
      totalSteps: totalStepsFallback,
    }
  );
}

export async function fetchStudentMissionRecommendationSignals(): Promise<Record<string, StudentMissionRecommendationSignal>> {
  const me = await getCurrentStudentIdentity();
  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("id,mission_id,status,updated_at,created_at")
    .eq("student_id", me.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string; mission_id: string; status: MissionAttempt["status"]; updated_at: string; created_at: string }>>();
  if (attemptsRes.error) throw attemptsRes.error;

  const attempts = attemptsRes.data ?? [];
  const signals = new Map<string, StudentMissionRecommendationSignal>();
  const missionIdByAttemptId = new Map<string, string>();

  for (const attempt of attempts) {
    missionIdByAttemptId.set(attempt.id, attempt.mission_id);
    const current = signals.get(attempt.mission_id);
    if (!current) {
      signals.set(attempt.mission_id, {
        missionId: attempt.mission_id,
        started: true,
        completed: attempt.status === "completed",
        latestStatus: attempt.status,
        hasHintUsage: false,
        hasIncorrectAnswer: false,
        recommendationStatus: attempt.status === "completed" ? "completed_ok" : "in_progress",
      });
      continue;
    }

    current.started = true;
    current.completed = current.completed || attempt.status === "completed";
  }

  for (const signal of signals.values()) {
    if (signal.latestStatus !== "completed") {
      signal.recommendationStatus = "in_progress";
    } else if (signal.hasHintUsage || signal.hasIncorrectAnswer) {
      signal.recommendationStatus = "completed_but_struggled";
    } else {
      signal.recommendationStatus = "completed_ok";
    }
  }

  return Object.fromEntries(Array.from(signals.entries()));
}

export async function fetchWeakConceptAnalysis(
  missions: GeneratedMission[],
  limit = 2
): Promise<WeakConceptAnalysis[]> {
  const conceptMissions = missions.filter((mission) => getMissionMainConcept(mission) !== null);
  if (conceptMissions.length === 0) return [];

  const me = await getCurrentStudentIdentity();
  const missionIds = conceptMissions.map((mission) => mission.id);
  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("id,mission_id,status,updated_at,created_at")
    .eq("student_id", me.id)
    .in("mission_id", missionIds)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string; mission_id: string; status: MissionAttempt["status"]; updated_at: string; created_at: string }>>();
  if (attemptsRes.error) throw attemptsRes.error;

  const attempts = attemptsRes.data ?? [];
  if (attempts.length === 0) return [];

  const attemptIds = attempts.map((attempt) => attempt.id);
  const stepAttemptsRes = await supabase
    .from("mission_step_attempts")
    .select("attempt_id,is_correct")
    .in("attempt_id", attemptIds)
    .returns<Array<{ attempt_id: string; is_correct: boolean | null }>>();
  if (stepAttemptsRes.error) throw stepAttemptsRes.error;

  const missionById = new Map(conceptMissions.map((mission) => [mission.id, mission]));
  const missionIdByAttemptId = new Map(attempts.map((attempt) => [attempt.id, attempt.mission_id]));
  const latestAttemptStatusByMissionId = new Map<string, MissionAttempt["status"]>();
  const struggledMissionIds = new Set<string>();
  const conceptScores = new Map<string, number>();

  for (const attempt of attempts) {
    if (!latestAttemptStatusByMissionId.has(attempt.mission_id)) {
      latestAttemptStatusByMissionId.set(attempt.mission_id, attempt.status);
    }
  }

  for (const row of stepAttemptsRes.data ?? []) {
    const missionId = missionIdByAttemptId.get(row.attempt_id);
    if (!missionId) continue;
    const mission = missionById.get(missionId);
    const mainConcept = mission ? getMissionMainConcept(mission) : null;
    if (!mainConcept) continue;

    let delta = 0;
    if (row.is_correct === false) delta += 2;

    if (delta === 0) continue;

    struggledMissionIds.add(missionId);
    conceptScores.set(mainConcept, (conceptScores.get(mainConcept) ?? 0) + delta);
  }

  const difficultyRank: Record<GeneratedMission["difficulty"], number> = {
    easy: 0,
    normal: 1,
    hard: 2,
    challenge: 2,
  };

  function recommendationRankForMission(missionId: string): number {
    const latestStatus = latestAttemptStatusByMissionId.get(missionId);
    if (!latestStatus) return 1;
    if (latestStatus !== "completed") return 2;
    if (struggledMissionIds.has(missionId)) return 3;
    return 4;
  }

  function rankedMissionIdsForConcept(conceptId: string, limitCount = 2): string[] {
    return conceptMissions
      .filter((mission) => getMissionMainConcept(mission) === conceptId)
      .sort((a, b) => {
        const rankDelta = recommendationRankForMission(a.id) - recommendationRankForMission(b.id);
        if (rankDelta !== 0) return rankDelta;

        const aCreatedAt = Date.parse(a.created_at);
        const bCreatedAt = Date.parse(b.created_at);
        const createdAtDelta = (Number.isFinite(bCreatedAt) ? bCreatedAt : 0) - (Number.isFinite(aCreatedAt) ? aCreatedAt : 0);
        if (createdAtDelta !== 0) return createdAtDelta;

        const difficultyDelta = difficultyRank[a.difficulty] - difficultyRank[b.difficulty];
        if (difficultyDelta !== 0) return difficultyDelta;
        return a.title.localeCompare(b.title, "ko");
      })
      .slice(0, Math.max(1, limitCount))
      .map((mission) => mission.id);
  }

  return Array.from(conceptScores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, limit))
    .map(([concept, score]) => {
      const conceptNode = getConceptNode(concept);
      const recommendedMissionIds = rankedMissionIdsForConcept(concept, 2);
      const shouldIncludePrerequisites = recommendedMissionIds.length < 2 || score >= 4;
      const prerequisiteRecommendations = shouldIncludePrerequisites
        ? (conceptNode?.prerequisites ?? [])
            .map((prerequisiteConcept) => ({
              concept: prerequisiteConcept,
              missionIds: rankedMissionIdsForConcept(prerequisiteConcept, 2),
            }))
            .filter((item) => item.missionIds.length > 0)
        : [];

      return {
        concept,
        score,
        recommendedMissionIds,
        prerequisiteRecommendations,
        nextConceptIds: conceptNode?.next ?? [],
      } satisfies WeakConceptAnalysis;
    })
    .filter(
      (item) =>
        (item.recommendedMissionIds.length > 0 || item.prerequisiteRecommendations.length > 0) &&
        (getConcept(item.concept) || getConceptNode(item.concept))
    );
}

export async function fetchRecentCompletedMissions(limit = 3): Promise<RecentCompletedMissionSummary[]> {
  const safeLimit = Math.max(1, limit);
  const me = await getCurrentStudentIdentity();
  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("mission_id,completed_at")
    .eq("student_id", me.id)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(safeLimit * 3)
    .returns<Array<{ mission_id: string; completed_at: string }>>();
  if (attemptsRes.error) throw attemptsRes.error;

  const uniqueAttempts: Array<{ mission_id: string; completed_at: string }> = [];
  const seenMissionIds = new Set<string>();
  for (const row of attemptsRes.data ?? []) {
    if (seenMissionIds.has(row.mission_id)) continue;
    seenMissionIds.add(row.mission_id);
    uniqueAttempts.push(row);
    if (uniqueAttempts.length >= safeLimit) break;
  }

  const missions = await Promise.all(
    uniqueAttempts.map(async (row) => {
      const mission = await fetchMissionById(row.mission_id);
      if (!mission) return null;
      return {
        missionId: row.mission_id,
        title: mission.title,
        completedAt: row.completed_at,
      } satisfies RecentCompletedMissionSummary;
    })
  );

  return missions.filter((row): row is RecentCompletedMissionSummary => row !== null);
}







