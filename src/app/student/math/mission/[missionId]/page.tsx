"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  completeMissionAttemptWithFeedback,
  fetchMissionProgress,
  getPublishedMissionById,
  getOrCreateActiveMissionAttempt,
  getStudentMissionStats,
  saveMissionStepResult,
} from "@/lib/missions";
import type { MissionCompletionFeedback, MissionProgressSummary } from "@/lib/missions";
import BadgeUnlockToast from "@/components/badges/BadgeUnlockToast";
import {
  MissionPill,
  MissionSurfaceCard,
  missionActionButtonClassName,
  missionCheckClassName,
  missionInputClassName,
  missionTextareaClassName,
  missionMutedTextClassName,
  missionOptionClassName,
} from "@/components/student/MissionCards";
import { areSameNumberSet, buildInputStepRetryMessage, buildMissionExplanation, buildMissionHintSequence, buildMissionSolution, isEquivalentAnswer, shouldRevealFullSolution } from "@/lib/missionAnswers";
import { normalizeUiText } from "@/lib/uiText";
import type { MissionStep } from "@/types/missions";
import IntroRenderer from "@/components/mission/IntroRenderer";
import ActivityRenderer from "@/components/mission/activities/ActivityRenderer";
import type { ActivityResult } from "@/components/mission/activities/activityShared";
import { isNewActivityType } from "@/components/mission/activities/activityShared";

type StepProgress = {
  submitted: boolean;
  isCorrect: boolean | null;
  submittedAnswer?: string;
  submittedChoiceIndexes?: number[];
};

type CompletionMeta = {
  earnedXp: number;
  baseXp: number;
  hintUsedCount: number;
  xpMessage: string;
  todayGoalAchieved: boolean;
  weeklyGoalAchieved: boolean;
  xpToNextLevel: number;
  currentLevel: number;
  leveledUp: boolean;
};

type MissionPresentation = {
  title: string;
  scenario: string;
  essentialQuestion: string;
  conceptSummary: string;
  learningGoal: string;
  difficulty: string;
  estimatedMinutes: number | null;
  unitId: string | null;
};

const UI = {
  loading: "\ubbf8\uc158\uc744 \ubd88\ub7ec\uc624\ub294 \uc911...",
  loadFailureTitle: "\ubbf8\uc158\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
  missingMissionId: "\ubbf8\uc158 ID\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  notFoundMathMission: "\uc218\ud559 \ubbf8\uc158\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.",
  loadFailureBody: "\ubbf8\uc158\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.",
  untitled: "\uc81c\ubaa9 \uc5c6\uc74c",
  noSteps: "\ub4f1\ub85d\ub41c \ub2e8\uacc4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  platform: "MVS MATH MISSION",
  essentialQuestion: "\ud575\uc2ec \uc9c8\ubb38",
  scenario: "\uc0c1\ud669",
  conceptSummary: "\uac1c\ub150 \uc694\uc57d",
  learningGoal: "\ud559\uc2b5 \ubaa9\ud45c",
  progress: "\uc9c4\ud589 \ud604\ud669",
  overallProgress: "\uc804\uccb4 \uc9c4\ud589\ub960",
  currentStep: "\ud604\uc7ac \ub2e8\uacc4",
  completedReplayNotice: "\uc774\uc804\uc5d0 \uc644\ub8cc\ud55c \ubbf8\uc158\uc774\uc9c0\ub9cc \ub2e4\uc2dc \ud559\uc2b5\ud560 \uc218 \uc788\uc5b4\uc694.",
  practiceBadge: "\ud83d\udd01 \uc774\ubbf8 \uc644\ub8cc\ud55c \ubbf8\uc158 \u00b7 \uc5f0\uc2b5 \ubaa8\ub4dc (XP \uc5c6\uc74c)",
  practiceCompleteTitle: "\uc5f0\uc2b5 \uc644\ub8cc! \ud83d\udc4f",
  practiceCompleteBody: "\uc5d0 \uc774\ubbf8 \ud074\ub9ac\uc5b4\ud55c \ubbf8\uc158\uc774\ub77c XP\ub294 \uc9c0\uae09\ub418\uc9c0 \uc54a\uc544\uc694.",
  practiceCompleteFooter: "\uc2e4\ub825 \uc810\uac80 \uc798 \ud588\uc5b4\uc694!",
  completionTitle: "\ubbf8\uc158 \uc644\ub8cc",
  completionDescription: "\ubaa8\ub4e0 \ub2e8\uacc4\ub97c \ub9c8\ucce4\uc5b4\uc694. \ubc30\uc6b4 \ub0b4\uc6a9\uc744 \ud55c \ubc88 \ub354 \uc815\ub9ac\ud574 \ubcf4\uc138\uc694.",
  todayGoal: "\uc624\ub298 \ubaa9\ud45c \ub2ec\uc131",
  weeklyGoal: "\uc774\ubc88 \uc8fc \ubaa9\ud45c \ub2ec\uc131",
  levelUpTitle: "\ub808\ubca8\uc5c5!",
  levelUpDescription: "\uc0c8\ub85c\uc6b4 \ub808\ubca8\uc5d0 \ub3c4\ub2ec\ud588\uc5b4\uc694.",
  nextGoalTitle: "\ub2e4\uc74c \ubaa9\ud45c",
  nextGoalDescription: "\ub2e4\uc74c \ud559\uc2b5\uc73c\ub85c \uc774\uc5b4\uac00\uba74 \ub808\ubca8\uc5c5\uc774 \ub354 \uac00\uae4c\uc6cc\uc838\uc694.",
  nextLevelRemaining: "\ub2e4\uc74c \ub808\ubca8\uae4c\uc9c0",
  xpRemainingSuffix: "XP \ub0a8\uc558\uc5b4\uc694",
  nextMissionHint: "\ub2e4\uc74c \ubbf8\uc158\ub3c4 \uc774\uc5b4\uc11c \ub3c4\uc804\ud574 \ubcf4\uc138\uc694.",
  selectType: "\uc120\ud0dd\ud615",
  multiSelectType: "\ubcf5\uc218 \uc120\ud0dd",
  inputType: "\uc9c1\uc811 \uc785\ub825",
  writingType: "\uc791\uc131\ud615",
  conceptType: "\uac1c\ub150 \ud559\uc2b5",
  introType: "\ub3c4\uc785",
  conceptCard: "\uac1c\ub150 \ud3ec\uc778\ud2b8",
  answerPlaceholder: "\ub2f5\uc744 \uc785\ub825\ud574 \ubcf4\uc138\uc694.",
  writingPlaceholder: "\uc5ec\uae30\uc5d0 \ud480\uc774\ub098 \uc124\uba85\uc744 \uc791\uc131\ud574 \ubcf4\uc138\uc694.",
  writingGuideTitle: "\uc791\uc131 \uac00\uc774\ub4dc",
  writingExampleTitle: "\uc608\uc2dc \uc791\uc131 \uac00\uc774\ub4dc",
  writingExpressionsTitle: "\ud575\uc2ec \ud45c\ud604",
  writingMistakesTitle: "\uc790\uc8fc \ud558\ub294 \uc2e4\uc218",
  writingSubmittedTitle: "\uc798 \uc791\uc131\ud588\uc5b4\uc694!",
  writingSubmittedBody: "\ub0b4 \uc0dd\uac01\uc744 \uc798 \ud45c\ud604\ud588\uc5b4\uc694. \uc544\ub798 \ud480\uc774 \uac00\uc774\ub4dc\ub97c \ucc38\uace0\ud574 \ub354 \ub2e4\ub4ec\uc5b4 \ubcf4\uc138\uc694.",
  writingCountLabel: "\ubb38\uc7a5/\uae00\uc790 \uc548\ub0b4",
  submit: "\uc81c\ucd9c\ud558\uae30",
  submitting: "\uc81c\ucd9c \uc911...",
  hintOpen: "\ud78c\ud2b8 \ubcf4\uae30",
  hintClose: "\ud78c\ud2b8 \uc811\uae30",
  solutionTitle: "\ud480\uc774 \uc774\ud574",
  solutionSummary: "\uc694\uc57d",
  solutionConcept: "\ud575\uc2ec \uac1c\ub150",
  solutionKeyConcept: "\ud575\uc2ec \uc124\uba85",
  solutionMistake: "\uc790\uc8fc \ud558\ub294 \uc2e4\uc218",
  solutionDetailsOpen: "\ud480\uc774 \uc790\uc138\ud788 \ubcf4\uae30",
  solutionDetailsClose: "\ud480\uc774 \uc811\uae30",
  xpBonusPrefix: "\uc2a4\uc2a4\ub85c \ud574\uacb0 \ubcf4\ub108\uc2a4",
  correct: "\uc815\ub2f5\uc785\ub2c8\ub2e4.",
  retry: "\ub2e4\uc2dc \uc0dd\uac01\ud574 \ubcf4\uc138\uc694.",
  saveFailure: "\ub2f5\uc548 \uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.",
  completeFailure: "\ubbf8\uc158 \uc644\ub8cc \ucc98\ub9ac\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.",
  summaryTitle: "\ud559\uc2b5 \ud3ec\uc778\ud2b8 \uc815\ub9ac",
  summaryQuestion: "\ub2e4\uc2dc \ub5a0\uc62c\ub9b4 \uc9c8\ubb38",
  summaryConcept: "\uc815\ub9ac\ud55c \uac1c\ub150",
  summaryGoal: "\ub2e4\uc74c\uc5d0\ub3c4 \uc368\uba39\uc744 \ubaa9\ud45c",
  summarySteps: "\ud559\uc2b5\ud55c \ub2e8\uacc4",
  resultTitle: "\ud480\uc774 \uacb0\uacfc \ud53c\ub4dc\ubc31",
  gradableInfo: "\ucc44\uc810 \ub300\uc0c1 \ub2e8\uacc4",
  strengthsLabel: "\uc798\ud55c \uc810",
  reviewLabel: "\ubcf5\uc2b5 \uc81c\uc548",
  wrongSummaryLabel: "\ud2c0\ub9b0 \ub2e8\uacc4 \ud574\uc124 \uc694\uc57d",
  noWrongSummary: "\ud2c0\ub9b0 \ub2e8\uacc4\uac00 \uc5c6\uc5b4\uc11c \uc9c0\uae08 \ud750\ub984\uc744 \uadf8\ub300\ub85c \uc720\uc9c0\ud558\uba74 \uc88b\uc544\uc694.",
  badgeEarnedTitle: "\uc0c8\ub85c\uc6b4 \uc218\ud559 \ubc30\uc9c0\ub97c \ud68d\ub4dd\ud588\uc5b4\uc694!",
  badgeEarnedLabel: "\uc0c8 \ubc30\uc9c0",
  home: "\ud648\uc73c\ub85c",
  previous: "\uc774\uc804",
  replay: "\ub2e4\uc2dc \ud558\uae30",
  next: "\ub2e4\uc74c \ub2e8\uacc4",
  backToList: "\ubaa9\ub85d\uc73c\ub85c \ub3cc\uc544\uac00\uae30",
  processing: "\ucc98\ub9ac \uc911...",
  missingQuestion: "\ud575\uc2ec \uc9c8\ubb38\uc744 \uc900\ube44 \uc911\uc785\ub2c8\ub2e4.",
  missingScenario: "\uc0c1\ud669 \uc124\uba85\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
  missingConceptSummary: "\uac1c\ub150 \uc694\uc57d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
  missingLearningGoal: "\ud559\uc2b5 \ubaa9\ud45c\ub97c \uc900\ube44 \uc911\uc785\ub2c8\ub2e4.",
} as const;

function decodeUnicode(text?: string | null): string {
  if (typeof text !== "string") return "";
  if (!text.includes("\\u")) return text;

  try {
    return JSON.parse(`"${text}"`) as string;
  } catch {
    return text;
  }
}

function displayInlineText(value: string | null | undefined, fallback = ""): string {
  const text = normalizeUiText(decodeUnicode(value));
  return text || fallback;
}

function displayBlockText(value: string | null | undefined, fallback = ""): string {
  const decoded = decodeUnicode(value)
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const text = decoded
    .split("\n")
    .map((line) => normalizeUiText(line))
    .filter(Boolean)
    .join("\n");

  return text || fallback;
}

function sanitizeInputAnswer(value: string | null | undefined): string {
  const decoded = decodeUnicode(value);
  if (!decoded) return "";
  if (decoded.includes("\\u")) return "";
  if (decoded === "???") return "";
  return decoded;
}

function isCorrectStepAnswer(step: MissionStep, studentAnswer: string): boolean {
  return isEquivalentAnswer(studentAnswer, step.correctAnswer, step);
}

function missionXpForDifficulty(value: string): number {
  return value === "challenge" || value === "hard" ? 15 : 10;
}

function difficultyLabel(value: string): string {
  if (value === "easy") return "\uc26c\uc6c0";
  if (value === "challenge" || value === "hard") return "\ub3c4\uc804";
  return "\ubcf4\ud1b5";
}

function progressLabel(progress: MissionProgressSummary | null, currentDisplayStep: number): string {
  if (!progress || progress.status === "not_started") {
    return `1 / ${progress?.totalSteps && progress.totalSteps > 0 ? progress.totalSteps : "-"} ${UI.currentStep}`;
  }

  const total = progress.totalSteps > 0 ? progress.totalSteps : "-";
  if (progress.status === "completed") {
    return `${total} / ${total} ${UI.currentStep}`;
  }

  const progressStep = Math.max(progress.lastStep ?? 0, currentDisplayStep);
  return `${progressStep} / ${total} ${UI.currentStep}`;
}

function stepTypeLabel(stepType: MissionStep["stepType"]): string {
  if (stepType === "choice") return UI.selectType;
  if (stepType === "multi_select") return UI.multiSelectType;
  if (stepType === "input") return UI.inputType;
  if (stepType === "writing") return UI.writingType;
  if (stepType === "concept") return UI.conceptType;
  return UI.introType;
}

function buildLearningPoints(mission: MissionPresentation | null, steps: MissionStep[]): string[] {
  if (!mission) return [];

  const points = [
    mission.learningGoal,
    mission.conceptSummary,
    mission.essentialQuestion,
    ...steps
      .filter((step) => step.stepType === "concept")
      .map((step) => displayInlineText(step.conceptTitle ?? step.title))
      .filter(Boolean),
  ];

  return Array.from(new Set(points)).filter(Boolean).slice(0, 5);
}

function isGradableStep(step: MissionStep | null): boolean {
  return step?.stepType === "choice" || step?.stepType === "input" || step?.stepType === "multi_select";
}

function isWritingStep(step: MissionStep | null): boolean {
  return step?.stepType === "writing" || step?.answerType === "writing";
}

function requiresStepSubmission(step: MissionStep | null): boolean {
  return isGradableStep(step) || isWritingStep(step) || isNewActivityType(step);
}

function buildWritingPlaceholder(step: MissionStep | null): string {
  const expectedSentenceCount = step?.expectedSentenceCount ?? 3;
  return decodeUnicode(step?.inputPlaceholder) || `여기에 ${expectedSentenceCount}문장 정도로 풀이 과정을 작성해 보세요.`;
}

function buildWritingGuide(step: MissionStep | null): string[] {
  if (step?.writingGuide && step.writingGuide.length > 0) return step.writingGuide.map((item) => decodeUnicode(item)).filter(Boolean);
  return [
    "1. 먼저 문제에서 구해야 하는 값을 한 문장으로 써 보세요.",
    "2. 필요한 조건이나 식을 정리해 보세요.",
    "3. 계산 또는 판단 과정을 순서대로 설명해 보세요.",
    "4. 마지막에 왜 그 답이 되는지 짧게 정리해 보세요.",
  ];
}

function buildWritingExpressions(step: MissionStep | null): string[] {
  if (step?.keyExpressions && step.keyExpressions.length > 0) return step.keyExpressions.map((item) => decodeUnicode(item)).filter(Boolean);
  return ["먼저", "따라서", "즉", "왜냐하면", "결론적으로"];
}

function buildWritingCommonMistakes(step: MissionStep | null): string[] {
  const s = step as (MissionStep & { scoringCriteria?: string[] }) | null;
  if (s?.scoringCriteria && s.scoringCriteria.length > 0) return s.scoringCriteria.map((item) => decodeUnicode(item)).filter(Boolean);
  if (step?.commonMistakes && step.commonMistakes.length > 0) return step.commonMistakes.map((item) => decodeUnicode(item)).filter(Boolean);
  return [
    "계산 결과만 쓰고 왜 그런지 설명하지 않는 경우",
    "문제 조건을 빠뜨리고 식만 적는 경우",
    "풀이 순서 없이 생각을 건너뛰는 경우",
  ];
}

function buildWritingSample(step: MissionStep | null): string {
  return displayBlockText(step?.sampleAnswer, "예: 먼저 구해야 하는 값을 정리합니다.\n그다음 필요한 식이나 조건을 찾습니다.\n이 식에 값을 대입해 계산합니다.\n계산 결과가 문제 상황에 맞는지 확인합니다.\n따라서 답을 정리할 수 있습니다.");
}

export default function MissionDetailPage() {
  const params = useParams<{ missionId: string }>();
  const router = useRouter();
  const missionId = params?.missionId ?? "";
  const stepStartedAtRef = useRef<number>(Date.now());
  const attemptIdRef = useRef<string | null>(null);
  const studentIdRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mission, setMission] = useState<MissionPresentation | null>(null);
  const [steps, setSteps] = useState<MissionStep[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [historicalAttemptStatus, setHistoricalAttemptStatus] = useState<MissionProgressSummary | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [selectedMultiChoices, setSelectedMultiChoices] = useState<number[]>([]);
  const [inputAnswer, setInputAnswer] = useState("");
  const [hintStageMap, setHintStageMap] = useState<Record<number, 0 | 1 | 2 | 3>>({});
  const [stepProgressMap, setStepProgressMap] = useState<Record<number, StepProgress>>({});
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [completionMeta, setCompletionMeta] = useState<CompletionMeta | null>(null);
  const [missionFeedback, setMissionFeedback] = useState<MissionCompletionFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [animatedEarnedXp, setAnimatedEarnedXp] = useState(0);
  const [badgeToastVisible, setBadgeToastVisible] = useState(false);
  const [solutionOpenMap, setSolutionOpenMap] = useState<Record<number, boolean>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [xpResult, setXpResult] = useState<Record<string, any> | null>(null);
  const [inputSuccessFlash, setInputSuccessFlash] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadMission() {
      if (!missionId) {
        if (!mounted) return;
        setError(UI.missingMissionId);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setSaveNotice(null);

      try {
        const loadedMission = await getPublishedMissionById("math", missionId);
        if (!mounted) return;

        if (!loadedMission) {
          console.warn("[MissionDetailPage] math mission unavailable", {
            missionId,
            reason: "not_found_or_not_published",
          });
          setError(UI.notFoundMathMission);
          setLoading(false);
          return;
        }

        const payload = loadedMission.mission_json;
        const totalSteps = payload.steps.length;
        const [attempt, missionProgress] = await Promise.all([
          getOrCreateActiveMissionAttempt(missionId),
          fetchMissionProgress(missionId, totalSteps),
        ]);
        if (!mounted) return;

        setMission({
          title: displayInlineText(payload.title, displayInlineText(loadedMission.title, UI.untitled)),
          scenario: displayBlockText(payload.scenario, displayInlineText(loadedMission.title, UI.missingScenario)),
          essentialQuestion: displayInlineText(payload.essentialQuestion, UI.missingQuestion),
          conceptSummary: displayBlockText(payload.conceptSummary, UI.missingConceptSummary),
          learningGoal: displayBlockText(payload.learningGoal ?? payload.essentialQuestion, UI.missingLearningGoal),
          difficulty: payload.difficulty ?? loadedMission.difficulty,
          estimatedMinutes: payload.estimatedMinutes ?? loadedMission.estimated_minutes,
          unitId: loadedMission.unit_id ?? null,
        });
        setSteps(payload.steps);
        console.info("[MissionDetailPage] mission attempt ready", {
          missionId,
          attemptId: attempt.id,
          missionSource: "generated_missions",
          totalSteps,
          reusedOrCreated: missionProgress.attemptId === attempt.id ? "reused" : "created_or_replaced",
        });
        attemptIdRef.current = attempt.id;
        studentIdRef.current = attempt.student_id;
        setAttemptId(attempt.id);
        setHistoricalAttemptStatus(missionProgress);
        setSelectedChoice("");
        setSelectedMultiChoices([]);
        setInputAnswer("");
        setHintStageMap({});
        setStepProgressMap({});
        setSessionCompleted(false);
        setCompletionMeta(null);
        setMissionFeedback(null);
        setAnimatedEarnedXp(0);
        setSolutionOpenMap({});
        setCurrentStepIndex(0);
        stepStartedAtRef.current = Date.now();
      } catch (loadError) {
        console.error("[MissionDetailPage] mission load failed", loadError);
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : UI.loadFailureBody);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadMission();
    return () => {
      mounted = false;
    };
  }, [missionId]);

  useEffect(() => {
    attemptIdRef.current = attemptId;
    if (attemptId) {
      console.info("[MissionDetailPage] attemptId state synced", {
        missionId,
        attemptId,
        studentId: studentIdRef.current,
        missionSource: "generated_missions",
      });
    }
  }, [attemptId, missionId]);

  useEffect(() => {
    setSelectedChoice("");
    setSelectedMultiChoices([]);
    setInputAnswer("");
    setSaveNotice(null);
    setInputSuccessFlash(false);
    setInputFocused(false);
    stepStartedAtRef.current = Date.now();
  }, [currentStepIndex]);

  const currentStep = useMemo(() => steps[currentStepIndex] ?? null, [currentStepIndex, steps]);
  const currentProgress = stepProgressMap[currentStepIndex];
  const isLastStep = steps.length > 0 && currentStepIndex === steps.length - 1;
  const showReplayActions = sessionCompleted && isLastStep;
  const currentDisplayStep = steps.length > 0 ? currentStepIndex + 1 : 0;
  const hasHistoricalCompletion = historicalAttemptStatus?.status === "completed";
  const requiresSubmission = requiresStepSubmission(currentStep);
  const sessionProgressSummary: MissionProgressSummary | null =
    steps.length > 0
      ? {
          missionId,
          attemptId,
          status: sessionCompleted ? "completed" : "in_progress",
          lastStep: sessionCompleted ? steps.length : currentDisplayStep,
          totalSteps: steps.length,
        }
      : null;
  const progressPercent =
    steps.length > 0 ? Math.min(100, Math.max(0, Math.round(((sessionCompleted ? steps.length : currentDisplayStep) / steps.length) * 100))) : 0;
  const learningPoints = useMemo(() => buildLearningPoints(mission, steps), [mission, steps]);
  const currentStepTitle = displayInlineText(currentStep?.title, `${UI.currentStep} ${currentDisplayStep || 1}`);
  const currentStepQuestion = displayBlockText(currentStep?.question, displayBlockText(currentStep?.explanation));
  const currentStepExplanation = displayBlockText(currentStep?.explanation);
  const currentIsWritingStep = isWritingStep(currentStep);
  const writingGuide = currentIsWritingStep ? buildWritingGuide(currentStep) : [];
  const writingExpressions = currentIsWritingStep ? buildWritingExpressions(currentStep) : [];
  const writingCommonMistakes = currentIsWritingStep ? buildWritingCommonMistakes(currentStep) : [];
  const writingSample = currentIsWritingStep ? buildWritingSample(currentStep) : "";
  const writingSentenceTarget = currentStep?.expectedSentenceCount ?? 3;
  const writingSentenceCount = inputAnswer
    .split(/[.!?]\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
  const writingCharacterCount = inputAnswer.trim().length;
  const currentConceptTitle = displayInlineText(currentStep?.conceptTitle ?? currentStep?.title, UI.conceptCard);
  const currentConceptDescription = displayBlockText(
    currentStep?.conceptDescription ?? currentStep?.explanation,
    mission?.conceptSummary ?? UI.missingConceptSummary
  );
  const hintSequence = currentIsWritingStep
    ? [
        { level: 1 as const, label: "힌트 1", buttonLabel: "힌트 1 보기", text: writingGuide.join("\n") },
        { level: 2 as const, label: "힌트 2", buttonLabel: "힌트 2 보기", text: writingExpressions.map((item) => `- ${item}`).join("\n") },
        { level: 3 as const, label: "힌트 3", buttonLabel: "힌트 3 보기", text: writingSample },
      ]
    : buildMissionHintSequence(currentStep, {
      subject: "math",
      conceptSummary: mission?.conceptSummary ?? null,
      missionTitle: mission?.title ?? null,
      scenario: mission?.scenario ?? null,
    });
  const revealedHintStage = hintStageMap[currentStepIndex] ?? 0;
  const activeHint = revealedHintStage > 0 ? hintSequence[Math.min(revealedHintStage, hintSequence.length) - 1] ?? null : null;
  const nextHint = revealedHintStage < hintSequence.length ? hintSequence[revealedHintStage] : null;
  const currentExplanationText = currentIsWritingStep
    ? "좋은 풀이 설명은 목표, 조건, 계산 과정, 결론이 순서대로 보입니다."
    : displayBlockText(buildMissionExplanation(currentStep, {
      subject: "math",
      conceptSummary: mission?.conceptSummary ?? null,
      missionTitle: mission?.title ?? null,
      scenario: mission?.scenario ?? null,
    }));
  const currentSolution = currentIsWritingStep
    ? { summary: "좋은 작성 답안은 무엇을 구하는지, 어떤 근거를 쓰는지, 결론이 무엇인지가 분명합니다.", steps: writingGuide, concept: writingExpressions.join(", "), commonMistake: writingCommonMistakes[0] }
    : buildMissionSolution(currentStep, {
    subject: "math",
    conceptSummary: mission?.conceptSummary ?? null,
    missionTitle: mission?.title ?? null,
    scenario: mission?.scenario ?? null,
  });
  const isSolutionOpen = solutionOpenMap[currentStepIndex] ?? false;
  const currentHintUsedCount = hintStageMap[currentStepIndex] ?? 0;
  const canRevealFullSolution = shouldRevealFullSolution(currentProgress?.isCorrect === true, currentHintUsedCount);
  const fallbackRetryMessage = buildInputStepRetryMessage(currentStep, currentProgress?.submittedAnswer ?? inputAnswer, currentStep?.correctAnswer, {
    subject: "math",
  });
  const feedbackMessage = currentIsWritingStep
    ? UI.writingSubmittedBody
    : currentProgress?.isCorrect
      ? displayBlockText(currentStep?.feedbackCorrect ?? currentExplanationText, UI.correct)
      : displayBlockText(currentStep?.feedbackIncorrect ?? fallbackRetryMessage, fallbackRetryMessage);
  const displayedEarnedXp = sessionCompleted ? animatedEarnedXp : (completionMeta?.earnedXp ?? missionXpForDifficulty(mission?.difficulty ?? "normal"));

  function getCurrentStepTimeSpentSeconds(): number {
    return Math.max(1, Math.round((Date.now() - stepStartedAtRef.current) / 1000));
  }

  function logMissionStepSaveError(label: string, error: unknown) {
    const errorObject = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
    let stringifiedError: string | null = null;

    try {
      stringifiedError = JSON.stringify(error);
    } catch {
      stringifiedError = null;
    }

    console.error(label, {
      rawError: error,
      stringifiedError,
      message: error instanceof Error ? error.message : errorObject?.message ?? null,
      code: errorObject?.code ?? null,
      details: errorObject?.details ?? null,
      hint: errorObject?.hint ?? null,
      missionId,
      currentStepIndex,
      stepOrder: currentStep?.stepOrder ?? null,
      stepType: currentStep?.stepType ?? null,
      attemptId: attemptIdRef.current ?? attemptId,
      studentId: studentIdRef.current,
      missionSource: "generated_missions",
    });
  }

  function logMissionFlow(label: string, extra?: Record<string, unknown>) {
    console.info(label, {
      missionId,
      currentStepIndex,
      stepOrder: currentStep?.stepOrder ?? null,
      stepType: currentStep?.stepType ?? null,
      attemptId: attemptIdRef.current ?? attemptId,
      studentId: studentIdRef.current,
      missionSource: "generated_missions",
      ...extra,
    });
  }

  function revealNextHint() {
    setHintStageMap((current) => {
      const currentStage = current[currentStepIndex] ?? 0;
      const maxStage = hintSequence.length;
      if (maxStage === 0 || currentStage >= maxStage) return current;
      return { ...current, [currentStepIndex]: (currentStage + 1) as 1 | 2 | 3 };
    });
  }

  function handleReplay() {
    setCurrentStepIndex(0);
    setSelectedChoice("");
    setSelectedMultiChoices([]);
    setInputAnswer("");
        setHintStageMap({});
    setStepProgressMap({});
    setSaveNotice(null);
    setSessionCompleted(false);
    setCompletionMeta(null);
    setMissionFeedback(null);
    setAnimatedEarnedXp(0);
    setSolutionOpenMap({});
    setXpResult(null);
    stepStartedAtRef.current = Date.now();
  }

  function toggleCurrentSolution() {
    setSolutionOpenMap((current) => ({
      ...current,
      [currentStepIndex]: !(current[currentStepIndex] ?? false),
    }));
  }

  function toggleMultiChoice(index: number) {
    setSelectedMultiChoices((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b)
    );
  }

  async function applyCompletionMeta(feedback: import("@/lib/missions").MissionCompletionFeedback) {
    const stats = await getStudentMissionStats("math");
    const baseXp = missionXpForDifficulty(mission?.difficulty ?? "normal");
    setCompletionMeta({
      earnedXp: feedback.earnedXp,
      baseXp,
      hintUsedCount: feedback.hintUsedCount,
      xpMessage: feedback.xpMessage,
      todayGoalAchieved: stats.todayCompletedCount >= 1,
      weeklyGoalAchieved: stats.weeklyCompletedCount >= 5,
      xpToNextLevel: feedback.xpToNextLevel,
      currentLevel: feedback.level,
      leveledUp: feedback.leveledUp,
    });
  }

  useEffect(() => {
    if (!sessionCompleted || !completionMeta) {
      setAnimatedEarnedXp(0);
      return;
    }

    const targetXp = completionMeta.earnedXp;
    if (targetXp <= 0) {
      setAnimatedEarnedXp(0);
      return;
    }

    let frame = 0;
    const totalFrames = 18;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      setAnimatedEarnedXp(Math.round(targetXp * progress));
      if (progress >= 1) {
        window.clearInterval(timer);
      }
    }, 45);

    return () => window.clearInterval(timer);
  }, [completionMeta, sessionCompleted]);

  useEffect(() => {
    if (!missionFeedback || missionFeedback.newlyEarnedBadges.length === 0) {
      setBadgeToastVisible(false);
      return;
    }

    setBadgeToastVisible(true);
    const timer = window.setTimeout(() => setBadgeToastVisible(false), 4800);
    return () => window.clearTimeout(timer);
  }, [missionFeedback]);

  async function finalizeMission() {
    const activeAttemptId = attemptIdRef.current ?? attemptId;
    if (!activeAttemptId || !mission) {
      logMissionFlow("[MissionDetailPage] finalize blocked", {
        reason: !mission ? "missing_mission" : "missing_attempt_id",
      });
      return;
    }

    setIsCompleting(true);
    setSaveNotice(null);
    try {
      logMissionFlow("[MissionDetailPage] finalize payload", {
        finalizedAttemptId: activeAttemptId,
        totalSteps: steps.length,
      });
      const feedback = await completeMissionAttemptWithFeedback({
        attemptId: activeAttemptId,
        missionId,
        unitId: mission.unitId,
        steps,
        hintUsedCount: Object.values(hintStageMap).reduce((sum, count) => sum + count, 0 as number),
      });
      await applyCompletionMeta(feedback);
      setMissionFeedback(feedback);
      const baseXp = missionXpForDifficulty(mission.difficulty);
      setXpResult({
        xp_earned: feedback.earnedXp,
        base_xp: baseXp,
        multiplier: baseXp > 0 && feedback.earnedXp > baseXp
          ? Math.round((feedback.earnedXp / baseXp) * 10) / 10 : 1,
        streak: feedback.streak,
        leveled_up: feedback.leveledUp,
        prev_level: feedback.prevLevel,
        level: feedback.level,
        level_title: `레벨 ${feedback.level}`,
        new_badges: feedback.newlyEarnedBadges.map(b => ({ title: b.name, key: b.key })),
        total_xp: feedback.totalXp,
        xp_to_next: feedback.xpToNextLevel,
      });
      setSessionCompleted(true);
      setHistoricalAttemptStatus((prev) => ({
        missionId,
        attemptId: activeAttemptId,
        status: "completed",
        lastStep: steps.length,
        totalSteps: prev?.totalSteps ?? steps.length,
      }));
    } catch (completeError) {
      logMissionStepSaveError("[MissionDetailPage] attempt completion failed", completeError);
      setSaveNotice(UI.completeFailure);
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleAdvance() {
    const activeAttemptId = attemptIdRef.current ?? attemptId;
    if (!currentStep || !activeAttemptId) {
      logMissionFlow("[MissionDetailPage] handleAdvance blocked", {
        reason: !currentStep ? "missing_current_step" : "missing_attempt_id",
      });
      return;
    }

    logMissionFlow("[MissionDetailPage] handleAdvance start", {
      currentProgressSubmitted: currentProgress?.submitted ?? false,
      requiresSubmission,
    });

    logMissionFlow("[MissionDetailPage] passive save skipped", { reason: "disabled_temporarily" });

    if (currentStepIndex < steps.length - 1) {
      logMissionFlow("[MissionDetailPage] handleAdvance move_next", { nextStepIndex: currentStepIndex + 1 });
      setCurrentStepIndex((prev) => prev + 1);
      return;
    }

    logMissionFlow("[MissionDetailPage] handleAdvance finalize_mission");
    await finalizeMission();
  }

  function handleBackToList() {
    router.push("/student/math");
  }
  function handlePrev() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }

  async function submitCurrentStep(studentAnswer: string, selectedIndexes?: number[]) {
    const activeAttemptId = attemptIdRef.current ?? attemptId;
    if (!currentStep || !activeAttemptId) {
      logMissionFlow("[MissionDetailPage] submit blocked", {
        reason: !currentStep ? "missing_current_step" : "missing_attempt_id",
      });
      return;
    }
    if (!requiresStepSubmission(currentStep)) return;

    const normalizedAnswer =
      currentStep.stepType === "choice"
        ? studentAnswer
        : currentStep.stepType === "multi_select"
          ? JSON.stringify([...(selectedIndexes ?? [])].sort((a, b) => a - b))
          : sanitizeInputAnswer(studentAnswer).trim();
    if (!normalizedAnswer) return;

    const isCorrect =
      currentIsWritingStep
        ? null
        : currentStep.stepType === "multi_select"
          ? areSameNumberSet(selectedIndexes ?? [], currentStep.correctChoiceIndexes ?? [])
          : isCorrectStepAnswer(currentStep, normalizedAnswer);
    const hintUsed = (hintStageMap[currentStepIndex] ?? 0) > 0;
    setIsSubmitting(true);
    setSaveNotice(null);

    try {
      console.info("[MissionDetailPage] submit payload", {
        missionId,
        attemptId: activeAttemptId,
        studentId: studentIdRef.current,
        stepOrder: currentStep.stepOrder,
        studentAnswer: normalizedAnswer,
        isCorrect,
        hintUsed,
      });
      await saveMissionStepResult({
        attemptId: activeAttemptId,
        missionId,
        stepOrder: currentStep.stepOrder,
        stepType: currentStep.stepType,
        studentAnswer: normalizedAnswer,
        isCorrect,
        hintUsed,
        timeSpentSeconds: getCurrentStepTimeSpentSeconds(),
      });

      setStepProgressMap((prev) => ({
        ...prev,
        [currentStepIndex]: {
          submitted: true,
          isCorrect,
          submittedAnswer: normalizedAnswer,
          submittedChoiceIndexes: currentStep.stepType === "multi_select" ? [...(selectedIndexes ?? [])] : undefined,
        },
      }));
      if (isCorrect === true) {
        setInputSuccessFlash(true);
        window.setTimeout(() => setInputSuccessFlash(false), 2000);
      }
    } catch (submitError) {
      logMissionStepSaveError("[MissionDetailPage] active step save failed", submitError);
      setSaveNotice(UI.saveFailure);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function recordActivityResult(result: ActivityResult) {
    const activeAttemptId = attemptIdRef.current ?? attemptId;
    if (!currentStep || !activeAttemptId) return;
    setIsSubmitting(true);
    setSaveNotice(null);
    try {
      const studentAnswer =
        result.studentAnswer && result.studentAnswer.trim().length > 0
          ? result.studentAnswer
          : JSON.stringify({ score: result.score });
      await saveMissionStepResult({
        attemptId: activeAttemptId,
        missionId,
        stepOrder: currentStep.stepOrder,
        stepType: currentStep.stepType,
        studentAnswer,
        isCorrect: result.correct,
        hintUsed: false,
        timeSpentSeconds: getCurrentStepTimeSpentSeconds(),
      });
      setStepProgressMap((prev) => ({
        ...prev,
        [currentStepIndex]: {
          submitted: true,
          isCorrect: result.correct,
          submittedAnswer: studentAnswer,
        },
      }));
      if (result.correct) {
        setInputSuccessFlash(true);
        window.setTimeout(() => setInputSuccessFlash(false), 2000);
      }
    } catch (err) {
      logMissionStepSaveError("[MissionDetailPage] activity save failed", err);
      setSaveNotice(UI.saveFailure);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-[var(--text)] sm:px-6 lg:max-w-5xl lg:px-8">
        <h1 className="text-2xl font-bold">{UI.loading}</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-[var(--text)] sm:px-6 lg:max-w-5xl lg:px-8">
        <h1 className="text-2xl font-bold">{UI.loadFailureTitle}</h1>
        <p className="mt-2 text-sm text-[var(--danger-text)]">{error}</p>
      </main>
    );
  }

  if (!mission || !currentStep) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-[var(--text)] sm:px-6 lg:max-w-5xl lg:px-8">
        <h1 className="text-2xl font-bold">{mission?.title || UI.untitled}</h1>
        <p className="mt-2 text-[var(--text-muted)]">{UI.noSteps}</p>
      </main>
    );
  }

  if (xpResult) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-[var(--text)] sm:px-6">
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 text-center">
          <div className="animate-bounce text-6xl">🎉</div>
          <h1 className="text-3xl font-black text-[var(--text)]">미션 완료!</h1>

          {/* XP 획득 */}
          <div className="w-full max-w-sm rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-6">
            <p className="text-5xl font-black text-[var(--accent)]">+{xpResult.xp_earned} XP</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              기본 {xpResult.base_xp} XP
              {xpResult.multiplier > 1 && ` × ${xpResult.multiplier} (${xpResult.streak}일 연속 보너스!)`}
            </p>
          </div>

          {/* 레벨업 */}
          {xpResult.leveled_up && (
            <div className="w-full max-w-sm rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4">
              <p className="text-xl font-bold text-yellow-400">
                ⭐ 레벨 업! {xpResult.prev_level} → {xpResult.level}
              </p>
              <p className="text-sm text-[var(--text-muted)]">{xpResult.level_title}</p>
            </div>
          )}

          {/* 새 배지 */}
          {xpResult.new_badges?.length > 0 && (
            <div className="w-full max-w-sm rounded-2xl border border-purple-400/40 bg-purple-400/10 p-4">
              <p className="font-bold text-purple-400">🏅 새 배지 획득!</p>
              {xpResult.new_badges.map((b: { title: string; key: string }) => (
                <p key={b.key} className="mt-1 text-sm text-[var(--text-muted)]">{b.title}</p>
              ))}
            </div>
          )}

          {/* 누적 정보 */}
          <div className="flex gap-4 text-sm text-[var(--text-muted)]">
            <span>총 XP: <strong className="text-[var(--text)]">{xpResult.total_xp}</strong></span>
            <span>레벨: <strong className="text-[var(--text)]">{xpResult.level}</strong></span>
            <span>다음까지: <strong className="text-[var(--text)]">{xpResult.xp_to_next} XP</strong></span>
          </div>

          {/* 버튼 */}
          <div className="flex w-full max-w-sm gap-3">
            <button
              onClick={() => router.push("/student/math")}
              className="flex-1 rounded-xl border border-[var(--border)] py-3 text-sm text-[var(--text-muted)] transition hover:border-[var(--accent)]"
            >
              ← 학습 루트
            </button>
            <button
              onClick={() => router.push("/student/math")}
              className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-[#0b1220] transition hover:opacity-90 active:scale-95"
            >
              다음 미션 →
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 pb-8 pt-4 text-[var(--text)] sm:px-6 md:pt-6 lg:max-w-5xl lg:px-8">
      <section
        className="rounded-3xl border p-5 md:p-7"
        style={{
          background: "var(--mission-shell-bg)",
          borderColor: "var(--mission-shell-border)",
          boxShadow: "var(--mission-shell-shadow)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]/80">{UI.platform}</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] md:text-4xl">{mission.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
              <MissionPill>{`\ub09c\uc774\ub3c4 ${difficultyLabel(mission.difficulty)}`}</MissionPill>
              <MissionPill>{`\uc608\uc0c1 ${mission.estimatedMinutes ?? 7}\ubd84`}</MissionPill>
              <MissionPill>{`\ucd1d ${steps.length}\ub2e8\uacc4`}</MissionPill>
              {hasHistoricalCompletion && !sessionCompleted && (
                <MissionPill variant="hint">{UI.practiceBadge}</MissionPill>
              )}
            </div>
          </div>
          <MissionSurfaceCard variant="accent" className="w-full max-w-sm p-4 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--mission-accent-text)]/80">{UI.essentialQuestion}</p>
            <p className="mt-2 break-words leading-6">{mission.essentialQuestion}</p>
          </MissionSurfaceCard>
        </div>

        <MissionSurfaceCard variant="default" className="mt-5 p-4">
          <div className={missionMutedTextClassName("flex flex-wrap items-center justify-between gap-3 text-sm")}>
            <p>{progressLabel(sessionProgressSummary, currentDisplayStep)}</p>
            <p>{`${UI.overallProgress} ${progressPercent}%`}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--mission-progress-track)]">
            <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, background: "var(--mission-progress-fill)" }} />
          </div>
          {hasHistoricalCompletion && !sessionCompleted && (
            <p className="mt-3 text-xs text-[var(--mission-success-text)]">{UI.completedReplayNotice}</p>
          )}
          {sessionCompleted && missionFeedback?.isPractice ? (
            <div className="mt-4 space-y-2 text-sm text-[var(--mission-success-text)]">
              <p className="font-semibold">{UI.practiceCompleteTitle}</p>
              <p>
                {missionFeedback.firstClearedAt
                  ? `${new Date(missionFeedback.firstClearedAt).toLocaleDateString("ko-KR")}${UI.practiceCompleteBody}`
                  : UI.practiceCompleteBody.replace(/^에 /, "")}
              </p>
              <p className="text-xs">{UI.practiceCompleteFooter}</p>
            </div>
          ) : sessionCompleted && (
            <div className="mt-4 space-y-2 text-sm text-[var(--mission-success-text)]">
              <p className="font-semibold">{UI.completionTitle}</p>
              <p>{UI.completionDescription}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <MissionPill variant="success" className="transition duration-300">
                  +{displayedEarnedXp} XP
                </MissionPill>
                {completionMeta?.todayGoalAchieved && (
                  <MissionPill variant="success">{UI.todayGoal}</MissionPill>
                )}
                {completionMeta?.weeklyGoalAchieved && (
                  <MissionPill variant="success">{UI.weeklyGoal}</MissionPill>
                )}
                {completionMeta?.leveledUp && (
                  <MissionPill variant="hint" className="animate-pulse">
                    {`${UI.levelUpTitle} Lv.${completionMeta.currentLevel}`}
                  </MissionPill>
                )}
                {completionMeta && completionMeta.baseXp > completionMeta.earnedXp && (
                  <MissionPill variant="accent">
                    {`${UI.xpBonusPrefix} +${completionMeta.earnedXp}`}
                  </MissionPill>
                )}
              </div>
              {missionFeedback && missionFeedback.hintUsedCount > 0 && missionFeedback.hintPenaltyPct > 0 && (
                <p className="text-xs text-[var(--text-muted)]">
                  {`💡 힌트 ${missionFeedback.hintUsedCount}개 사용 — XP ${missionFeedback.hintPenaltyPct}% 차감`}
                </p>
              )}
              {completionMeta?.xpMessage && <p className="text-xs text-[var(--mission-success-text)]">{completionMeta.xpMessage}</p>}
              {completionMeta && <p className="text-xs text-[var(--mission-success-text)]">{`${UI.nextLevelRemaining} ${completionMeta.xpToNextLevel}${UI.xpRemainingSuffix}`}</p>}
            </div>
          )}
        </MissionSurfaceCard>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {/* 상황 카드 */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--mission-shell-border)] dark:border-[rgba(250,204,21,0.1)] bg-[var(--mission-panel-bg)] dark:bg-[rgba(20,30,50,0.6)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#f97316] to-[#fb923c] dark:from-amber-400 dark:to-yellow-500" />
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm">📋</span>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f97316] dark:text-amber-400">상황</p>
          </div>
          <IntroRenderer text={mission.scenario ?? ""} subject="math" />
        </div>
        {/* 개념 요약 카드 */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--mission-shell-border)] dark:border-[rgba(250,204,21,0.1)] bg-[var(--mission-panel-bg)] dark:bg-[rgba(20,30,50,0.6)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#ec4899] to-[#f472b6] dark:from-yellow-400 dark:to-amber-400" />
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm">💡</span>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ec4899] dark:text-yellow-400">개념 요약</p>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--text)] dark:text-[#e5d7a0]">{mission.conceptSummary}</p>
        </div>
        {/* 학습 목표 카드 */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--mission-shell-border)] dark:border-[rgba(250,204,21,0.1)] bg-[var(--mission-panel-bg)] dark:bg-[rgba(20,30,50,0.6)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#22c55e] to-[#4ade80] dark:from-yellow-200 dark:to-yellow-400" />
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#22c55e] dark:text-yellow-300">학습 목표</p>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--text)] dark:text-[#e5d7a0]">{mission.learningGoal}</p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-[var(--mission-shell-border)]">
        {/* 미션 헤더 — 라이트: 핑크, 다크: 딥네이비-골드 */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#D4537E] to-[#c44070] dark:from-[#1a1a2e] dark:via-[#2d2a1a] dark:to-[#3d3520] px-5 py-5 md:px-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/[0.07] dark:bg-yellow-400/[0.06]" />
          <div className="pointer-events-none absolute -right-3 top-8 h-16 w-16 rounded-full bg-white/[0.05] dark:bg-yellow-300/[0.04]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-block rounded-full bg-white/20 dark:bg-yellow-400/20 px-3 py-1 text-[11px] font-semibold text-white dark:text-[#fde68a]">
                개념 적용 미션
              </span>
              <h2 className="mt-2 text-xl font-semibold text-white dark:text-[#fde68a]">{currentStepTitle}</h2>
            </div>
            <span className="inline-block rounded-full bg-white/20 dark:bg-yellow-400/20 px-3 py-1 text-[11px] font-semibold text-white dark:text-[#fde68a]">
              {currentStep.stepType === "input" ? "✏️ 직접 입력"
                : currentStep.stepType === "choice" ? "✓ 객관식"
                : currentStep.stepType === "multi_select" ? "✓ 복수 선택"
                : currentStep.stepType === "writing" ? "📝 서술형"
                : currentStep.stepType === "concept" ? "📖 개념 학습"
                : currentStep.stepType === "self_explain" ? "🧠 메타인지"
                : currentStep.stepType === "fill_in_blanks" ? "🔤 빈칸 채우기"
                : currentStep.stepType === "drag_and_drop" ? "🎯 분류·매칭"
                : currentStep.stepType === "compare" ? "⚖️ 비교 분석"
                : stepTypeLabel(currentStep.stepType)}
            </span>
          </div>
          {/* XP 게이지: 숫자 + 도트 */}
          <div className="relative mt-4 flex items-center gap-3">
            <span className="text-sm font-medium text-white/80 dark:text-yellow-200/80">{`${currentDisplayStep} / ${steps.length}`}</span>
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => {
                const done = i < currentStepIndex || sessionCompleted;
                const curr = i === currentStepIndex && !sessionCompleted;
                return (
                  <span
                    key={i}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition-all duration-300"
                    style={
                      done
                        ? { background: "white", color: "#c44070" }
                        : curr
                        ? { background: "transparent", border: "2px solid white", color: "white", boxShadow: "0 0 0 3px rgba(255,255,255,0.3)" }
                        : { background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.35)" }
                    }
                  >
                    {done ? "✓" : ""}
                  </span>
                );
              })}
            </div>
          </div>
          {/* 프로그레스 트랙 */}
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, background: "rgba(255,255,255,0.85)" }}
            />
          </div>
        </div>

        <div className="bg-[var(--mission-panel-bg)] p-5 md:p-6">
        <MissionSurfaceCard variant="default" className="min-w-0 p-4 sm:p-5">
          {currentStepQuestion && <p className="whitespace-pre-line break-words text-sm leading-7 sm:text-base">{currentStepQuestion}</p>}
          {!currentStepQuestion && currentStepExplanation && (
            <p className="whitespace-pre-line break-words text-sm leading-7 sm:text-base">{currentStepExplanation}</p>
          )}

          {currentStep.stepType === "concept" && (
            <MissionSurfaceCard variant="explanation" className="mt-5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--mission-explanation-text)]/80">{UI.conceptCard}</p>
              <h3 className="mt-2 text-xl font-semibold">{currentConceptTitle}</h3>
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-6">{currentConceptDescription}</p>
            </MissionSurfaceCard>
          )}

          {currentStep.stepType === "choice" && currentStep.choices && (
            <div className="mt-6 space-y-3">
              {currentStep.choices.map((choice) => {
                const choiceLabel = displayInlineText(choice);
                const active = selectedChoice === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setSelectedChoice(choice)}
                    className={`${missionOptionClassName(active)} whitespace-normal break-words`}
                  >
                    {choiceLabel}
                  </button>
                );
              })}
            </div>
          )}

          {currentStep.stepType === "multi_select" && currentStep.choices && (
            <div className="mt-6 space-y-3">
              {currentStep.choices.map((choice, index) => {
                const choiceLabel = displayInlineText(choice);
                const active = selectedMultiChoices.includes(index);
                return (
                  <button
                    key={`${choice}:${index}`}
                    type="button"
                    onClick={() => toggleMultiChoice(index)}
                    className={`${missionOptionClassName(active)} flex items-start gap-3 whitespace-normal break-words`}
                  >
                    <span className={missionCheckClassName(active)}>
                      ✓
                    </span>
                    <span>{choiceLabel}</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentStep.stepType === "input" && (
            <div className="mt-6">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-200 ${
                    inputFocused
                      ? "bg-[#fce7f3] text-[#c44070] dark:bg-[rgba(250,204,21,0.15)] dark:text-[rgba(250,204,21,0.9)]"
                      : "bg-[var(--mission-shell-border)] text-[var(--text-muted)]"
                  }`}
                >
                  변하는 값
                </span>
              </div>
              <input
                value={sanitizeInputAnswer(inputAnswer)}
                onChange={(event) => setInputAnswer(sanitizeInputAnswer(event.target.value))}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={displayInlineText(currentStep.inputPlaceholder, UI.answerPlaceholder)}
                inputMode={currentStep.answerType === "number" ? "decimal" : "text"}
                className={missionInputClassName()}
                style={
                  inputSuccessFlash
                    ? { borderColor: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)", transition: "all 0.3s" }
                    : inputFocused
                    ? { borderColor: "var(--accent)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)", transition: "all 0.2s" }
                    : { transition: "all 0.2s" }
                }
              />
            </div>
          )}

          {isNewActivityType(currentStep) && (
            <div className="mt-6">
              <ActivityRenderer
                step={currentStep}
                subject="math"
                disabled={currentProgress?.submitted ?? false}
                onComplete={(result) => void recordActivityResult(result)}
              />
            </div>
          )}

          {currentIsWritingStep && (
            <div className="mt-6 space-y-4">
              <textarea
                value={sanitizeInputAnswer(inputAnswer)}
                onChange={(event) => setInputAnswer(sanitizeInputAnswer(event.target.value))}
                placeholder={buildWritingPlaceholder(currentStep)}
                rows={8}
                className={missionTextareaClassName()}
              />
              <div className="flex flex-wrap gap-2 text-xs text-[var(--mission-default-muted)]">
                <MissionPill>{`${UI.writingCountLabel} ${writingSentenceCount}/${writingSentenceTarget}문장`}</MissionPill>
                <MissionPill>{`${writingCharacterCount}자 작성`}</MissionPill>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <MissionSurfaceCard variant="hint" className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-hint-text)]/80">{UI.writingGuideTitle}</p>
                  <div className="mt-3 space-y-2 text-sm leading-6">
                    {writingGuide.map((item) => (
                      <p key={item} className="whitespace-pre-line break-words">{item}</p>
                    ))}
                  </div>
                </MissionSurfaceCard>
                <MissionSurfaceCard variant="default" className="p-4">
                  <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.18em]")}>{UI.writingExpressionsTitle}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {writingExpressions.map((item) => (
                      <MissionPill key={item}>{item}</MissionPill>
                    ))}
                  </div>
                </MissionSurfaceCard>
                <MissionSurfaceCard variant="explanation" className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-explanation-text)]/80">{UI.writingExampleTitle}</p>
                  <p className="mt-3 whitespace-pre-line break-words text-sm leading-6">{writingSample}</p>
                </MissionSurfaceCard>
              </div>
            </div>
          )}

          {(currentStep.stepType === "choice" || currentStep.stepType === "input" || currentStep.stepType === "multi_select" || currentIsWritingStep) && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() =>
                  void submitCurrentStep(
                    currentStep.stepType === "choice" ? selectedChoice : currentStep.stepType === "multi_select" ? "" : inputAnswer,
                    currentStep.stepType === "multi_select" ? selectedMultiChoices : undefined
                  )
                }
                disabled={
                  isSubmitting ||
                  (currentStep.stepType === "choice"
                    ? !selectedChoice
                    : currentStep.stepType === "multi_select"
                      ? selectedMultiChoices.length === 0
                      : !inputAnswer.trim())
                }
                className={missionActionButtonClassName("primary", "w-full px-5 sm:w-auto")}
              >
                {isSubmitting ? UI.submitting : UI.submit}
              </button>
            </div>
          )}

          {!isNewActivityType(currentStep) && (nextHint || activeHint) && (
            <div className="mt-6 space-y-3">
              {nextHint && (
                <button
                  type="button"
                  onClick={revealNextHint}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[var(--mission-shell-border)] dark:border-[rgba(250,204,21,0.2)] bg-transparent px-4 py-3 text-left transition-all hover:border-[#ec4899]/50 dark:hover:border-[rgba(250,204,21,0.45)] hover:bg-[#fdf0f5] dark:hover:bg-[rgba(250,204,21,0.05)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{revealedHintStage === 0 ? "🔒" : "💡"}</span>
                    <span className="text-sm font-medium text-[var(--text)]">{nextHint.buttonLabel}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#fce7f3", color: "#c44070" }}>
                      -10 XP
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {`남은 힌트 ${hintSequence.length - revealedHintStage}개`}
                  </span>
                </button>
              )}
              {activeHint && (
                <div
                  className="rounded-xl border border-[rgba(236,72,153,0.3)] bg-[#fdf0f5] p-4 text-sm dark:border-[rgba(250,204,21,0.25)] dark:bg-[rgba(250,204,21,0.08)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ec4899] dark:bg-[rgba(250,204,21,0.85)] text-[10px] font-bold text-white dark:text-[#0b1220]">
                      {revealedHintStage}
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ec4899] dark:text-[rgba(250,204,21,0.9)]">
                      {activeHint.label}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-line break-words leading-6 text-gray-700 dark:text-[#e5d7a0]">{displayBlockText(activeHint.text)}</p>
                </div>
              )}
            </div>
          )}

          {currentProgress?.submitted && !isNewActivityType(currentStep) && (
            <>
              <MissionSurfaceCard variant={currentIsWritingStep ? "explanation" : currentProgress.isCorrect ? "success" : "error"} className="mt-6 p-4 text-sm">
                <p className="font-semibold">{currentIsWritingStep ? UI.writingSubmittedTitle : currentProgress.isCorrect ? UI.correct : UI.retry}</p>
                <p className="mt-2 whitespace-pre-line break-words leading-6">{feedbackMessage}</p>
              </MissionSurfaceCard>
              {currentExplanationText && (
                <MissionSurfaceCard variant="explanation" className="mt-4 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-explanation-text)]/80">{UI.solutionTitle}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mission-explanation-text)]/75">
                    {currentIsWritingStep ? UI.writingGuideTitle : currentProgress.isCorrect ? UI.solutionSummary : UI.solutionKeyConcept}
                  </p>
                  <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.summary}</p>

                  {currentIsWritingStep && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <MissionSurfaceCard variant="default" className="p-4">
                        <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.16em]")}>{UI.writingExpressionsTitle}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {writingExpressions.map((item) => (
                            <MissionPill key={`feedback:${item}`}>{item}</MissionPill>
                          ))}
                        </div>
                      </MissionSurfaceCard>
                      <MissionSurfaceCard variant="hint" className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mission-hint-text)]/80">{UI.writingMistakesTitle}</p>
                        <div className="mt-3 space-y-2">
                          {writingCommonMistakes.map((item) => (
                            <p key={item} className="whitespace-pre-line break-words leading-6">{item}</p>
                          ))}
                        </div>
                      </MissionSurfaceCard>
                    </div>
                  )}

                  {!currentIsWritingStep && !currentProgress.isCorrect && (
                    <div className="mt-4 space-y-3">
                      <MissionSurfaceCard variant="default" className="p-4">
                        <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.16em]")}>{UI.solutionConcept}</p>
                        <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.concept}</p>
                      </MissionSurfaceCard>
                      {currentSolution.commonMistake && (
                        <MissionSurfaceCard variant="hint" className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mission-hint-text)]/80">{UI.solutionMistake}</p>
                          <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.commonMistake}</p>
                        </MissionSurfaceCard>
                      )}
                    </div>
                  )}

                  {!currentIsWritingStep && (currentProgress.isCorrect || canRevealFullSolution) && (
                    <button
                      type="button"
                      onClick={toggleCurrentSolution}
                      className={missionActionButtonClassName("secondary", "mt-4 px-4 py-2")}
                    >
                      {isSolutionOpen ? UI.solutionDetailsClose : UI.solutionDetailsOpen}
                    </button>
                  )}

                  {!currentIsWritingStep && !currentProgress.isCorrect && !canRevealFullSolution && (
                    <p className="mt-4 text-sm leading-6 text-[var(--mission-explanation-text)]/85">
                      힌트를 더 보면서 다시 생각해 보세요. 마지막 힌트까지 보면 자세한 풀이도 열 수 있어요.
                    </p>
                  )}

                  {!currentIsWritingStep && isSolutionOpen && (currentProgress.isCorrect || canRevealFullSolution) && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-3">
                        {currentSolution.steps.map((item, index) => (
                          <MissionSurfaceCard key={`${currentStepIndex}:solution:${index}`} variant="default" className="p-4">
                            <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.16em]")}>{`STEP ${index + 1}`}</p>
                            <p className="mt-2 whitespace-pre-line break-words leading-6">{item}</p>
                          </MissionSurfaceCard>
                        ))}
                      </div>
                      <MissionSurfaceCard variant="default" className="p-4">
                        <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.16em]")}>{UI.solutionConcept}</p>
                        <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.concept}</p>
                      </MissionSurfaceCard>
                      {currentSolution.commonMistake && (
                        <MissionSurfaceCard variant="hint" className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mission-hint-text)]/80">{UI.solutionMistake}</p>
                          <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.commonMistake}</p>
                        </MissionSurfaceCard>
                      )}
                    </div>
                  )}
                </MissionSurfaceCard>
              )}
            </>
          )}

          {saveNotice && <p className="mt-4 text-sm text-[var(--danger-text)]">{saveNotice}</p>}
        </MissionSurfaceCard>
        </div>

        <div className="sticky bottom-3 z-20 mt-0 grid grid-cols-1 gap-3 rounded-b-3xl border-t border-[var(--mission-shell-border)] bg-[var(--mission-overlay-bg)] p-3 backdrop-blur sm:grid-cols-2">
          <button
            type="button"
            onClick={showReplayActions ? handleReplay : handlePrev}
            disabled={showReplayActions ? false : currentStepIndex === 0 || isCompleting || isSubmitting}
            className={missionActionButtonClassName("secondary")}
          >
            {showReplayActions ? UI.replay : UI.previous}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLastStep && sessionCompleted) {
                handleBackToList();
                return;
              }
              void handleAdvance();
            }}
            disabled={steps.length === 0 || isCompleting || isSubmitting || (requiresSubmission && !currentProgress?.submitted)}
            className={missionActionButtonClassName("primary")}
          >
            {isLastStep ? (sessionCompleted ? (isCompleting ? UI.processing : UI.backToList) : UI.next) : UI.next}
          </button>
        </div>
      </section>

      {sessionCompleted && (
        <section className="mt-6 rounded-3xl border border-[var(--mission-shell-border)] bg-[var(--mission-panel-strong-bg)] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--mission-success-text)]/80">{UI.summaryTitle}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">
                {missionFeedback?.isPractice ? UI.practiceCompleteTitle : UI.completionTitle}
              </h2>
              {missionFeedback?.isPractice && (
                <p className="mt-2 text-sm text-[var(--mission-success-text)]">
                  {missionFeedback.firstClearedAt
                    ? `${new Date(missionFeedback.firstClearedAt).toLocaleDateString("ko-KR")}${UI.practiceCompleteBody}`
                    : UI.practiceCompleteBody.replace(/^에 /, "")}
                </p>
              )}
            </div>
            {missionFeedback?.isPractice ? (
              <MissionPill variant="hint">{UI.practiceBadge}</MissionPill>
            ) : (
              <MissionPill variant="success">{`+${displayedEarnedXp} XP`}</MissionPill>
            )}
          </div>

          {completionMeta?.leveledUp && (
            <MissionSurfaceCard variant="hint" className="mt-5 p-4">
              <p className="text-sm font-semibold">{`${UI.levelUpTitle} Lv.${completionMeta.currentLevel}`}</p>
              <p className="mt-2 break-words text-sm leading-6">{UI.levelUpDescription}</p>
            </MissionSurfaceCard>
          )}
          {missionFeedback && (
            <MissionSurfaceCard variant="default" className="mt-5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.18em]")}>{UI.resultTitle}</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text)]">{`${Math.round(missionFeedback.accuracy * 100)}%`}</p>
                  <p className={missionMutedTextClassName("mt-2 text-sm")}>{`${missionFeedback.correctSteps} / ${missionFeedback.gradableSteps} ${UI.gradableInfo}`}</p>
                </div>
                <div className="max-w-md space-y-3 text-sm text-[var(--text)]">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{UI.strengthsLabel}</p>
                    <p className="mt-1 break-words leading-6">{missionFeedback.strengthMessage}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text)]">{UI.reviewLabel}</p>
                    <p className="mt-1 break-words leading-6">{missionFeedback.reviewMessage}</p>
                  </div>
                </div>
              </div>

              <MissionSurfaceCard variant="default" className="mt-4 p-4">
                <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.18em]")}>{UI.wrongSummaryLabel}</p>
                {missionFeedback.incorrectStepSummaries.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {missionFeedback.incorrectStepSummaries.map((item) => (
                      <MissionSurfaceCard key={`${item.stepOrder}:${item.title}`} variant="default" className="p-4">
                        <p className="text-sm font-semibold text-[var(--text)]">{`${item.stepOrder}. ${displayInlineText(item.title)}`}</p>
                        <p className={missionMutedTextClassName("mt-2 break-words text-sm leading-6")}>{displayBlockText(item.summary)}</p>
                      </MissionSurfaceCard>
                    ))}
                  </div>
                ) : (
                  <p className={missionMutedTextClassName("mt-3 text-sm leading-6")}>{UI.noWrongSummary}</p>
                )}
              </MissionSurfaceCard>
            </MissionSurfaceCard>
          )}

          {missionFeedback && missionFeedback.newlyEarnedBadges.length > 0 && (
            <MissionSurfaceCard variant="success" className="mt-5 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-success-text)]/80">{UI.badgeEarnedLabel}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{UI.badgeEarnedTitle}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {missionFeedback.newlyEarnedBadges.map((badge) => (
                  <MissionSurfaceCard key={`${badge.key}:${badge.earnedAt}`} variant="default" className="p-4">
                    <p className="text-sm font-semibold text-[var(--text)]">{badge.name}</p>
                    <p className={missionMutedTextClassName("mt-2 text-sm leading-6")}>{badge.description}</p>
                  </MissionSurfaceCard>
                ))}
              </div>
            </MissionSurfaceCard>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MissionSurfaceCard variant="default" className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-success-text)]/80">{UI.summaryQuestion}</p>
              <p className="mt-3 text-sm leading-6">{mission.essentialQuestion}</p>
            </MissionSurfaceCard>
            <MissionSurfaceCard variant="default" className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-success-text)]/80">{UI.summaryConcept}</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6">{mission.conceptSummary}</p>
            </MissionSurfaceCard>
            <MissionSurfaceCard variant="default" className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-success-text)]/80">{UI.summaryGoal}</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6">{mission.learningGoal}</p>
            </MissionSurfaceCard>
          </div>

          <MissionSurfaceCard variant="default" className="mt-5 p-4">
            <p className={missionMutedTextClassName("text-xs font-semibold uppercase tracking-[0.18em]")}>{UI.summarySteps}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {steps.map((step) => (
                <MissionPill key={step.stepOrder}>
                  {displayInlineText(step.title, `${UI.currentStep} ${step.stepOrder}`)}
                </MissionPill>
              ))}
            </div>
          </MissionSurfaceCard>

          <MissionSurfaceCard variant="accent" className="mt-5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-accent-text)]/80">{UI.nextGoalTitle}</p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {completionMeta ? `${UI.nextLevelRemaining} ${completionMeta.xpToNextLevel}${UI.xpRemainingSuffix}` : `${UI.nextLevelRemaining} 0${UI.xpRemainingSuffix}`}
                </p>
                <p className="mt-2 text-sm leading-6">{UI.nextGoalDescription}</p>
              </div>
              <MissionPill variant="accent">{UI.nextMissionHint}</MissionPill>
            </div>
          </MissionSurfaceCard>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Link href="/student/math" className={missionActionButtonClassName("secondary")}>
              {UI.home}
            </Link>
            <button type="button" onClick={handleReplay} className={missionActionButtonClassName("primary")}>
              {UI.replay}
            </button>
          </div>
          {learningPoints.length > 0 && (
            <MissionSurfaceCard variant="default" className="mt-5 p-4">
              <div className="space-y-2 text-sm text-[var(--text)]">
                {learningPoints.map((point) => (
                  <p key={point} className="leading-6">{`- ${point}`}</p>
                ))}
              </div>
            </MissionSurfaceCard>
          )}
        </section>
      )}
    </main>
      {badgeToastVisible && missionFeedback && missionFeedback.newlyEarnedBadges.length > 0 && (
        <BadgeUnlockToast
          badges={missionFeedback.newlyEarnedBadges}
          onClose={() => setBadgeToastVisible(false)}
        />
      )}
    </>
  );
}
