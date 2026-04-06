import type { MissionHint, MissionSolution, MissionStep } from "@/types/missions";

const DEFAULT_ACCEPTED_UNITS = [
  "원",
  "개",
  "명",
  "cm",
  "m",
  "kg",
  "g",
  "%",
  "번",
  "초",
  "분",
  "시간",
];

type AnswerRuleConfig = {
  answerType?: MissionStep["answerType"];
  acceptedAnswers?: string[];
  acceptedUnits?: string[];
};

export type NormalizedAnswer = {
  raw: string;
  text: string;
  compactText: string;
  lowerText: string;
  numericText: string | null;
  numericValue: number | null;
};

export type MissionHintStage = {
  level: 1 | 2 | 3;
  label: string;
  buttonLabel: string;
  text: string;
};

type MissionHintContext = {
  subject?: "math" | "english";
  conceptSummary?: string | null;
  missionTitle?: string | null;
  scenario?: string | null;
};

type MathHintCategory = "expression" | "function" | "fraction" | "data" | "geometry" | "ratio" | "default";

function asCleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNumericCore(value: string): string {
  return value.replace(/,/g, "").replace(/\s+/g, "").trim();
}

function normalizeHintAnalysisText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const text = asCleanString(value);
    if (text) return text;
  }
  return null;
}

function uniqueNonEmptyLines(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => asCleanString(value))
        .filter(Boolean)
    )
  );
}

function buildHintSource(step: MissionStep | null, context?: MissionHintContext): string {
  return [
    step?.title,
    step?.question,
    step?.explanation,
    context?.missionTitle,
    context?.scenario,
    context?.conceptSummary,
  ]
    .map((value) => asCleanString(value))
    .filter(Boolean)
    .join(" ");
}

function isGenericHintText(value: string): boolean {
  const normalized = normalizeHintAnalysisText(value);
  if (!normalized) return true;

  const genericPatterns = [
    /문제를 잘 읽/,
    /천천히 생각/,
    /개념을 떠올/,
    /공식을 떠올/,
    /정답을 다시/,
    /한번 더 계산/,
    /문제 상황을 보/,
    /잘 확인/,
  ];

  return genericPatterns.some((pattern) => pattern.test(normalized));
}

function textLeaksAnswer(step: MissionStep | null, text: string): boolean {
  const normalized = normalizeHintAnalysisText(text);
  if (!normalized) return false;
  if (/정답은|answer is|the answer/.test(normalized)) return true;

  const candidates = [
    step?.correctAnswer,
    ...(step?.acceptedAnswers ?? []),
  ]
    .map((value) => normalizeHintAnalysisText(asCleanString(value)))
    .filter(Boolean);

  return candidates.some((candidate) => {
    if (!candidate) return false;
    if (/^-?\d+(?:\.\d+)?$/.test(candidate)) {
      return new RegExp(`(^|[^\\d])${escapeRegExp(candidate)}([^\\d]|$)`).test(normalized);
    }
    return candidate.length >= 2 && normalized.includes(candidate);
  });
}

function sanitizeHintText(step: MissionStep | null, text: string | null): string | null {
  const normalized = firstNonEmpty(text);
  if (!normalized) return null;
  if (isGenericHintText(normalized)) return null;
  if (textLeaksAnswer(step, normalized)) return null;
  return normalized;
}

function inferMathHintCategory(step: MissionStep | null, context?: MissionHintContext): MathHintCategory {
  const text = normalizeHintAnalysisText(buildHintSource(step, context));

  if (/x|y|식|계수|고정비|변하는 값|일차식|문자와 식/.test(text)) return "expression";
  if (/기울기|절편|표|그래프|함수|포물선|꼭짓점|변화량/.test(text)) return "function";
  if (/분수|분모|분자|소수|공통분모|자릿수/.test(text)) return "fraction";
  if (/확률|비율|응답|전체|부분|자료|분포|평균/.test(text)) return "data";
  if (/피타고라스|직각|대각선|길이|도형|삼각형|넓이|원주/.test(text)) return "geometry";
  if (/비례|비율|할인|속도|단위당|정률|배수/.test(text)) return "ratio";

  return "default";
}

function getMathHintTemplates(category: MathHintCategory): MissionHint[] {
  switch (category) {
    case "expression":
      return [
        { level: 1, text: "문제에서 한 번만 정해지는 값과, 수가 바뀔 때마다 함께 변하는 값을 따로 표시해 보세요." },
        { level: 2, text: "무엇이 기준값이고 무엇이 반복되는 변화량인지 구분하면 식의 구조가 보입니다." },
        { level: 3, text: "반복되는 양을 먼저 표현한 뒤 마지막에 고정된 값을 붙인다는 흐름으로 정리해 보세요." },
      ];
    case "function":
      return [
        { level: 1, text: "표나 그래프에서 한 칸 이동할 때 값이 어떻게 달라지는지 먼저 관찰해 보세요." },
        { level: 2, text: "시작 지점의 값과, 한 번 이동할 때마다 누적되는 변화를 분리해서 생각해 보세요." },
        { level: 3, text: "찾은 변화 규칙을 현재 묻는 입력값에 적용하면 어떤 계산 순서가 필요한지 보일 거예요." },
      ];
    case "fraction":
      return [
        { level: 1, text: "지금 두 수가 같은 기준으로 비교되고 있는지 먼저 확인해 보세요." },
        { level: 2, text: "기준이 다르면 같은 단위나 같은 크기로 바꾼 뒤 비교해야 의미가 생깁니다." },
        { level: 3, text: "기준을 맞춘 다음에는 어느 부분을 더하거나 비교해야 하는지만 차분히 따라가 보세요." },
      ];
    case "data":
      return [
        { level: 1, text: "문제에서 전체와 부분이 각각 무엇인지 먼저 나눠 적어 보세요." },
        { level: 2, text: "값 자체를 비교할지, 전체에 대한 비율을 비교할지 판단하면 해석이 쉬워집니다." },
        { level: 3, text: "같은 기준으로 다시 읽고, 질문이 요구하는 비교 방식에 맞춰 결론을 정리해 보세요." },
      ];
    case "geometry":
      return [
        { level: 1, text: "도형에서 이미 알고 있는 길이와 아직 구해야 하는 길이를 구분해 표시해 보세요." },
        { level: 2, text: "직각, 대각선, 밑변과 높이처럼 어떤 관계를 이용해야 하는지 먼저 떠올려 보세요." },
        { level: 3, text: "필요한 길이를 바로 구하지 말고, 먼저 중간에 알아야 할 길이나 수치를 찾는 순서를 세워 보세요." },
      ];
    case "ratio":
      return [
        { level: 1, text: "서로 다른 정보를 바로 비교하지 말고 같은 기준 단위로 먼저 맞춰 보세요." },
        { level: 2, text: "비율은 숫자 자체보다 기준 대비 얼마나 바뀌는지를 보는 개념이라는 점을 떠올려 보세요." },
        { level: 3, text: "기준을 하나 정한 뒤 나머지를 그 기준으로 환산하면 어떤 선택이 유리한지 판단할 수 있습니다." },
      ];
    default:
      return [
        { level: 1, text: "질문이 마지막에 알고 싶은 값이 무엇인지 한 줄로 다시 써 보세요." },
        { level: 2, text: "그 값을 얻기 전에 먼저 알아야 하는 중간 정보가 있는지 찾아 보세요." },
        { level: 3, text: "중간 정보에서 마지막 답으로 이어지는 계산이나 판단 순서를 한 단계씩 정리해 보세요." },
      ];
  }
}

function getEnglishHintTemplates(): MissionHint[] {
  return [
    { level: 1, text: "누가 누구에게 어떤 상황에서 말하는지 먼저 정리해 보세요." },
    { level: 2, text: "상황에 맞는 핵심 표현 한 가지를 고른 뒤, 그 표현이 쓰이는 의도를 생각해 보세요." },
    { level: 3, text: "표현을 고른 다음에는 주어와 동사, 또는 질문과 응답의 흐름이 자연스러운지 확인해 보세요." },
  ];
}

function buildMathSolution(step: MissionStep | null, context?: MissionHintContext): MissionSolution {
  const category = inferMathHintCategory(step, context);
  const conceptLineCandidate = firstNonEmpty(step?.explanation, context?.conceptSummary);
  const conceptLine = textLeaksAnswer(step, conceptLineCandidate ?? "")
    ? "문제의 조건을 같은 기준으로 읽고 필요한 관계를 연결하는 것이 핵심입니다."
    : (conceptLineCandidate ?? "문제의 조건을 같은 기준으로 읽고 필요한 관계를 연결하는 것이 핵심입니다.");
  const situation = firstNonEmpty(step?.question, context?.scenario, step?.title, "문제 상황");

  const stepSets: Record<MathHintCategory, string[]> = {
    expression: [
      `${situation}에서 한 번만 정해지는 값과 반복해서 늘어나는 값을 나눠 봅니다.`,
      "반복되는 변화가 무엇을 기준으로 생기는지 확인하고 식의 뼈대를 세웁니다.",
      "세운 식이 질문에서 묻는 상황과 정확히 대응하는지 마지막으로 확인합니다.",
    ],
    function: [
      "표나 그래프에서 입력이 한 칸 변할 때 출력이 얼마나 달라지는지 읽습니다.",
      "시작값과 변화량을 분리해서 규칙을 설명합니다.",
      "그 규칙을 문제에서 묻는 지점에 적용해 결과를 해석합니다.",
    ],
    fraction: [
      "비교하거나 계산하려는 수들이 같은 기준인지 먼저 확인합니다.",
      "기준이 다르면 같은 크기로 맞춘 뒤 수를 다시 읽습니다.",
      "맞춘 기준 위에서 어떤 수를 더하거나 비교해야 하는지 차례대로 판단합니다.",
    ],
    data: [
      "문제에서 전체, 부분, 비교 대상이 각각 무엇인지 분명히 합니다.",
      "숫자 자체를 볼지 비율을 볼지 정한 뒤 자료를 다시 해석합니다.",
      "질문이 요구하는 비교 방식에 맞춰 결론을 정리합니다.",
    ],
    geometry: [
      "도형에서 알고 있는 정보와 아직 구해야 하는 정보를 먼저 구분합니다.",
      "길이, 각도, 넓이처럼 어떤 관계를 써야 하는 상황인지 판단합니다.",
      "중간에 필요한 값을 순서대로 구한 뒤 마지막 질문에 연결합니다.",
    ],
    ratio: [
      "서로 다른 정보를 같은 기준 단위로 맞춰 비교 가능한 상태를 만듭니다.",
      "기준 대비 얼마나 변하는지 읽으며 관계를 해석합니다.",
      "환산한 결과를 바탕으로 더 알맞은 선택이나 값을 결정합니다.",
    ],
    default: [
      "문제가 묻는 최종 목표를 먼저 확인합니다.",
      "그 목표에 도달하기 전에 필요한 중간 정보를 찾습니다.",
      "중간 정보에서 최종 답으로 이어지는 순서를 따라가며 결론을 정리합니다.",
    ],
  };

  return {
    summary: "이 문제는 숫자를 바로 대입하기보다, 상황 속 관계를 먼저 읽어야 제대로 풀립니다.",
    steps: stepSets[category],
    concept: conceptLine,
    commonMistake: "계산을 바로 시작하기 전에 무엇이 기준값이고 무엇이 변하는지 먼저 나누지 않으면 풀이가 흔들리기 쉽습니다.",
  };
}

function buildEnglishSolution(step: MissionStep | null, context?: MissionHintContext): MissionSolution {
  const situation = firstNonEmpty(step?.question, context?.scenario, step?.title, "대화 상황");
  const conceptLineCandidate = firstNonEmpty(step?.explanation, context?.conceptSummary);
  const conceptLine = textLeaksAnswer(step, conceptLineCandidate ?? "")
    ? "상황에 맞는 표현을 고르고 문장 흐름을 자연스럽게 만드는 것이 핵심입니다."
    : (conceptLineCandidate ?? "상황에 맞는 표현을 고르고 문장 흐름을 자연스럽게 만드는 것이 핵심입니다.");

  return {
    summary: "이 문제는 단어 하나를 찍는 것이 아니라, 말하는 상황과 의도에 맞는 표현을 고르는 연습입니다.",
    steps: [
      `${situation}에서 화자와 목적을 먼저 파악합니다.`,
      "상황에 맞는 표현이나 문장 틀을 고른 뒤 그 표현이 왜 어울리는지 확인합니다.",
      "마지막으로 문장 순서와 어조가 자연스러운지 점검하며 답을 정리합니다.",
    ],
    concept: conceptLine,
    commonMistake: "단어 뜻만 보고 고르면 상황과 어조가 어긋날 수 있어서, 누가 누구에게 말하는지 먼저 확인하는 습관이 중요합니다.",
  };
}

function sanitizeSolution(step: MissionStep | null, solution: MissionSolution | null | undefined): MissionSolution | null {
  if (!solution) return null;
  const summary = firstNonEmpty(solution.summary);
  const concept = firstNonEmpty(solution.concept);
  const steps = uniqueNonEmptyLines(solution.steps);
  const commonMistake = firstNonEmpty(solution.commonMistake);
  if (!summary || !concept || steps.length === 0) return null;
  if (textLeaksAnswer(step, summary) || textLeaksAnswer(step, concept)) return null;

  const safeSteps = steps.filter((item) => !textLeaksAnswer(step, item));
  if (safeSteps.length === 0) return null;

  return {
    summary,
    steps: safeSteps,
    concept,
    commonMistake: commonMistake && !textLeaksAnswer(step, commonMistake) ? commonMistake : undefined,
  };
}

function normalizeHintsFromStep(step: MissionStep | null, context?: MissionHintContext): MissionHint[] {
  const structuredHints = (step?.hints ?? [])
    .map((hint) => ({
      level: hint.level,
      text: sanitizeHintText(step, hint.text),
    }))
    .filter((hint): hint is MissionHint => (hint.level === 1 || hint.level === 2 || hint.level === 3) && Boolean(hint.text))
    .sort((left, right) => left.level - right.level);

  if (structuredHints.length > 0) {
    const byLevel = new Map<number, MissionHint>();
    for (const hint of structuredHints) {
      if (!byLevel.has(hint.level)) byLevel.set(hint.level, hint);
    }
    return [1, 2, 3]
      .map((level) => byLevel.get(level))
      .filter((hint): hint is MissionHint => Boolean(hint));
  }

  const explicit = [
    sanitizeHintText(step, step?.hintLevel1),
    sanitizeHintText(step, step?.hintLevel2),
    sanitizeHintText(step, step?.hintLevel3),
    sanitizeHintText(step, step?.hint),
  ].filter((hint): hint is string => Boolean(hint));

  const templates = context?.subject === "english"
    ? getEnglishHintTemplates()
    : getMathHintTemplates(inferMathHintCategory(step, context));

  const merged: MissionHint[] = [];
  for (const template of templates) {
    const explicitText = explicit[template.level - 1];
    const text = explicitText ?? template.text;
    if (!merged.some((item) => item.text === text)) {
      merged.push({ level: template.level, text });
    }
  }

  return merged;
}

export function buildMissionSolution(step: MissionStep | null, context?: MissionHintContext): MissionSolution {
  const explicit = sanitizeSolution(step, step?.solution);
  if (explicit) return explicit;

  return context?.subject === "english"
    ? buildEnglishSolution(step, context)
    : buildMathSolution(step, context);
}

export function buildMissionStepHint(step: MissionStep | null, context?: MissionHintContext): string {
  return normalizeHintsFromStep(step, context)[0]?.text ?? "";
}

export function getNormalizedHints(step: MissionStep | null, context?: MissionHintContext): MissionHint[] {
  return normalizeHintsFromStep(step, context);
}

export function getSolutionContent(step: MissionStep | null, context?: MissionHintContext): MissionSolution {
  return buildMissionSolution(step, context);
}

const HINT_XP_MULTIPLIERS = [1, 0.9, 0.75, 0.6] as const;

export const getHintAdjustedXp = (baseXp: number, hintUsedCount: number): number => {
  const safeBaseXp = Math.max(0, Math.floor(baseXp));
  const safeHintCount = Math.max(0, Math.min(3, Math.floor(hintUsedCount)));
  const multiplier = HINT_XP_MULTIPLIERS[safeHintCount] ?? HINT_XP_MULTIPLIERS[3];
  return Math.max(1, Math.floor(safeBaseXp * multiplier));
};

export const shouldRevealFullSolution = (isCorrect: boolean, hintUsedCount: number): boolean => {
  if (isCorrect) return true;
  return hintUsedCount >= 3;
};

export function normalizeMissionStepContent(
  step: MissionStep | null,
  context?: MissionHintContext
): { hints: MissionHint[]; solution: MissionSolution } {
  return {
    hints: getNormalizedHints(step, context),
    solution: getSolutionContent(step, context),
  };
}

export function normalizeNumericAnswer(value: unknown, acceptedUnits: string[] = DEFAULT_ACCEPTED_UNITS): string | null {
  const raw = normalizeNumericCore(asCleanString(value));
  if (!raw) return null;

  const sortedUnits = [...acceptedUnits]
    .filter((unit) => unit.trim().length > 0)
    .sort((left, right) => right.length - left.length);

  const unitPattern = sortedUnits.length > 0 ? `(${sortedUnits.map(escapeRegExp).join("|")})+$` : "";
  const withoutUnits = unitPattern ? raw.replace(new RegExp(unitPattern, "i"), "") : raw;
  const numericCandidate = withoutUnits.trim();
  if (!numericCandidate) return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(numericCandidate)) return null;

  const numericValue = Number(numericCandidate);
  if (Number.isNaN(numericValue)) return null;
  return String(numericValue);
}

export function normalizeAnswerInput(value: unknown, acceptedUnits: string[] = DEFAULT_ACCEPTED_UNITS): NormalizedAnswer {
  const raw = String(value ?? "");
  const text = normalizeWhitespace(raw);
  const compactText = text.replace(/,/g, "").replace(/\s+/g, "");
  const lowerText = text.toLowerCase();
  const numericText = normalizeNumericAnswer(text, acceptedUnits);
  const numericValue = numericText === null ? null : Number(numericText);

  return {
    raw,
    text,
    compactText,
    lowerText,
    numericText,
    numericValue,
  };
}

export function areSameNumberSet(a: number[], b: number[]): boolean {
  const left = Array.from(new Set(a.map((item) => Math.round(item)))).sort((x, y) => x - y);
  const right = Array.from(new Set(b.map((item) => Math.round(item)))).sort((x, y) => x - y);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function buildCandidateValues(step: AnswerRuleConfig, expectedAnswer: unknown): unknown[] {
  return [expectedAnswer, ...(step.acceptedAnswers ?? [])].filter((value) => String(value ?? "").trim().length > 0);
}

function resolveAcceptedUnits(step: AnswerRuleConfig): string[] {
  return step.acceptedUnits && step.acceptedUnits.length > 0
    ? Array.from(new Set([...DEFAULT_ACCEPTED_UNITS, ...step.acceptedUnits]))
    : DEFAULT_ACCEPTED_UNITS;
}

export function isEquivalentAnswer(
  userInput: unknown,
  expectedAnswer: unknown,
  step: AnswerRuleConfig,
  options?: { ignoreCase?: boolean }
): boolean {
  const acceptedUnits = resolveAcceptedUnits(step);
  const user = normalizeAnswerInput(userInput, acceptedUnits);
  const candidates = buildCandidateValues(step, expectedAnswer).map((candidate) => normalizeAnswerInput(candidate, acceptedUnits));
  const ignoreCase = options?.ignoreCase ?? false;

  return candidates.some((candidate) => {
    if (user.numericValue !== null && candidate.numericValue !== null) {
      return user.numericValue === candidate.numericValue;
    }

    if (ignoreCase) {
      return user.lowerText === candidate.lowerText;
    }

    return user.text === candidate.text;
  });
}

export function buildMissionHintSequence(step: MissionStep | null, context?: MissionHintContext): MissionHintStage[] {
  return getNormalizedHints(step, context).map((hint) => ({
    level: hint.level,
    label: hint.level === 1 ? "방향 힌트" : hint.level === 2 ? "풀이 힌트" : "거의 다 왔어요 힌트",
    buttonLabel: `힌트 ${hint.level} 보기`,
    text: hint.text,
  }));
}

export function buildMissionExplanation(step: MissionStep | null, context?: MissionHintContext): string {
  return getSolutionContent(step, context).summary;
}

export function buildInputStepRetryMessage(
  step: MissionStep | null,
  studentAnswer: unknown,
  expectedAnswer: unknown,
  options?: { subject?: "math" | "english"; ignoreCase?: boolean }
): string {
  if (!step) return "다시 생각해 보세요.";

  const acceptedUnits = resolveAcceptedUnits(step);
  const user = normalizeAnswerInput(studentAnswer, acceptedUnits);
  const expected = normalizeAnswerInput(expectedAnswer, acceptedUnits);

  if (step.answerType === "number") {
    if (user.numericValue !== null && expected.numericValue !== null && user.numericValue !== expected.numericValue) {
      return "바로 답을 고치기보다, 어떤 수를 먼저 구해야 하는지 순서를 다시 세워 보세요.";
    }
    return "숫자 표현보다 먼저 문제 상황에서 어떤 관계를 읽었는지 다시 확인해 보세요.";
  }

  if (options?.subject === "english") {
    return "표현 하나를 다시 고르기보다, 이 문장이 어떤 상황에서 쓰이는 말인지부터 다시 떠올려 보세요.";
  }

  return "질문이 요구하는 마지막 값과, 그 전에 필요한 중간 값을 다시 연결해 보세요.";
}
