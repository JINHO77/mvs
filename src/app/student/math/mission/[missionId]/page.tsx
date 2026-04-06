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
  getStudentXpSummary,
  saveMissionStepResult,
} from "@/lib/missions";
import type { MissionCompletionFeedback, MissionProgressSummary } from "@/lib/missions";
import BadgeUnlockToast from "@/components/badges/BadgeUnlockToast";
import { areSameNumberSet, buildInputStepRetryMessage, buildMissionExplanation, buildMissionHintSequence, buildMissionSolution, isEquivalentAnswer, shouldRevealFullSolution } from "@/lib/missionAnswers";
import { normalizeUiText } from "@/lib/uiText";
import type { MissionStep } from "@/types/missions";

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
  overallProgress: "\uc804\ccb4 \uc9c4\ud589\ub960",
  currentStep: "\ud604\uc7ac \ub2e8\uacc4",
  completedReplayNotice: "\uc774\uc804\uc5d0 \uc644\ub8cc\ud55c \ubbf8\uc158\uc774\uc9c0\ub9cc \ub2e4\uc2dc \ud559\uc2b5\ud560 \uc218 \uc788\uc5b4\uc694.",
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
  conceptType: "\uac1c\ub150 \ud559\uc2b5",
  introType: "\ub3c4\uc785",
  conceptCard: "\uac1c\ub150 \ud3ec\uc778\ud2b8",
  answerPlaceholder: "\ub2f5\uc744 \uc785\ub825\ud574 \ubcf4\uc138\uc694.",
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
    stepStartedAtRef.current = Date.now();
  }, [currentStepIndex]);

  const currentStep = useMemo(() => steps[currentStepIndex] ?? null, [currentStepIndex, steps]);
  const currentProgress = stepProgressMap[currentStepIndex];
  const isLastStep = steps.length > 0 && currentStepIndex === steps.length - 1;
  const showReplayActions = sessionCompleted && isLastStep;
  const currentDisplayStep = steps.length > 0 ? currentStepIndex + 1 : 0;
  const hasHistoricalCompletion = historicalAttemptStatus?.status === "completed";
  const requiresSubmission = isGradableStep(currentStep);
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
  const currentConceptTitle = displayInlineText(currentStep?.conceptTitle ?? currentStep?.title, UI.conceptCard);
  const currentConceptDescription = displayBlockText(
    currentStep?.conceptDescription ?? currentStep?.explanation,
    mission?.conceptSummary ?? UI.missingConceptSummary
  );
  const hintSequence = buildMissionHintSequence(currentStep, {
      subject: "math",
      conceptSummary: mission?.conceptSummary ?? null,
      missionTitle: mission?.title ?? null,
      scenario: mission?.scenario ?? null,
    });
  const revealedHintStage = hintStageMap[currentStepIndex] ?? 0;
  const activeHint = revealedHintStage > 0 ? hintSequence[Math.min(revealedHintStage, hintSequence.length) - 1] ?? null : null;
  const nextHint = revealedHintStage < hintSequence.length ? hintSequence[revealedHintStage] : null;
  const currentExplanationText = displayBlockText(buildMissionExplanation(currentStep, {
      subject: "math",
      conceptSummary: mission?.conceptSummary ?? null,
      missionTitle: mission?.title ?? null,
      scenario: mission?.scenario ?? null,
    }));
  const currentSolution = buildMissionSolution(currentStep, {
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
  const feedbackMessage = currentProgress?.isCorrect
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

  async function applyCompletionMeta(previousLevel: number, earnedXp: number, hintUsedCount: number, xpMessage: string) {
    const stats = await getStudentMissionStats("math");
    const xpSummary = await getStudentXpSummary("math");
    const baseXp = missionXpForDifficulty(mission?.difficulty ?? "normal");
    setCompletionMeta({
      earnedXp,
      baseXp,
      hintUsedCount,
      xpMessage,
      todayGoalAchieved: stats.todayCompletedCount >= 1,
      weeklyGoalAchieved: stats.weeklyCompletedCount >= 5,
      xpToNextLevel: xpSummary.xpToNextLevel,
      currentLevel: xpSummary.level,
      leveledUp: xpSummary.level > previousLevel,
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
      const previousXpSummary = await getStudentXpSummary("math");
      logMissionFlow("[MissionDetailPage] finalize payload", {
        finalizedAttemptId: activeAttemptId,
        totalSteps: steps.length,
      });
      const feedback = await completeMissionAttemptWithFeedback({
        attemptId: activeAttemptId,
        missionId,
        unitId: mission.unitId,
        steps,
        hintUsedCount: Object.values(hintStageMap).reduce((sum, count) => sum + count, 0),
      });
      await applyCompletionMeta(previousXpSummary.level, feedback.earnedXp, feedback.hintUsedCount, feedback.xpMessage);
      setMissionFeedback(feedback);
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
    if (!isGradableStep(currentStep)) return;

    const normalizedAnswer =
      currentStep.stepType === "choice"
        ? studentAnswer
        : currentStep.stepType === "multi_select"
          ? JSON.stringify([...(selectedIndexes ?? [])].sort((a, b) => a - b))
          : sanitizeInputAnswer(studentAnswer).trim();
    if (!normalizedAnswer) return;

    const isCorrect =
      currentStep.stepType === "multi_select"
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
    } catch (submitError) {
      logMissionStepSaveError("[MissionDetailPage] active step save failed", submitError);
      setSaveNotice(UI.saveFailure);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-white sm:px-6 lg:max-w-5xl lg:px-8">
        <h1 className="text-2xl font-bold">{UI.loading}</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-white sm:px-6 lg:max-w-5xl lg:px-8">
        <h1 className="text-2xl font-bold">{UI.loadFailureTitle}</h1>
        <p className="mt-2 text-sm text-red-300">{error}</p>
      </main>
    );
  }

  if (!mission || !currentStep) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-white sm:px-6 lg:max-w-5xl lg:px-8">
        <h1 className="text-2xl font-bold">{mission?.title || UI.untitled}</h1>
        <p className="mt-2 text-slate-300">{UI.noSteps}</p>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 pb-8 pt-4 text-white sm:px-6 md:pt-6 lg:max-w-5xl lg:px-8">
      <section className="rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.35)] md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-300/80">{UI.platform}</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{mission.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200 sm:text-sm">
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">{`\ub09c\uc774\ub3c4 ${difficultyLabel(mission.difficulty)}`}</span>
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">{`\uc608\uc0c1 ${mission.estimatedMinutes ?? 7}\ubd84`}</span>
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">{`\ucd1d ${steps.length}\ub2e8\uacc4`}</span>
            </div>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-200/80">{UI.essentialQuestion}</p>
            <p className="mt-2 break-words leading-6">{mission.essentialQuestion}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <p>{progressLabel(sessionProgressSummary, currentDisplayStep)}</p>
            <p>{`${UI.overallProgress} ${progressPercent}%`}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-amber-400 to-emerald-300" style={{ width: `${progressPercent}%` }} />
          </div>
          {hasHistoricalCompletion && !sessionCompleted && (
            <p className="mt-3 text-xs text-emerald-200">{UI.completedReplayNotice}</p>
          )}
          {sessionCompleted && (
            <div className="mt-4 space-y-2 text-sm text-emerald-100">
              <p className="font-semibold">{UI.completionTitle}</p>
              <p>{UI.completionDescription}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-100 transition duration-300">
                  +{displayedEarnedXp} XP
                </span>
                {completionMeta?.todayGoalAchieved && (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-100">{UI.todayGoal}</span>
                )}
                {completionMeta?.weeklyGoalAchieved && (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-100">{UI.weeklyGoal}</span>
                )}
                {completionMeta?.leveledUp && (
                  <span className="animate-pulse rounded-full border border-yellow-300/40 bg-yellow-400/15 px-3 py-1 text-yellow-100">
                    {`${UI.levelUpTitle} Lv.${completionMeta.currentLevel}`}
                  </span>
                )}
                {completionMeta && completionMeta.baseXp > completionMeta.earnedXp && (
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-cyan-50">
                    {`${UI.xpBonusPrefix} +${completionMeta.earnedXp}`}
                  </span>
                )}
              </div>
              {completionMeta?.xpMessage && <p className="text-xs text-emerald-50">{completionMeta.xpMessage}</p>}
              {completionMeta && <p className="text-xs text-emerald-50">{`${UI.nextLevelRemaining} ${completionMeta.xpToNextLevel}${UI.xpRemainingSuffix}`}</p>}
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{UI.scenario}</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">{mission.scenario}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{UI.conceptSummary}</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">{mission.conceptSummary}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{UI.learningGoal}</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">{mission.learningGoal}</p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 md:p-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{UI.progress}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{currentStepTitle}</h2>
            <p className="mt-2 text-sm text-slate-400">{`${currentDisplayStep} / ${steps.length} ${UI.currentStep}`}</p>
          </div>
          <span className="w-fit rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-sm text-yellow-100">
            {stepTypeLabel(currentStep.stepType)}
          </span>
        </div>

        <div className="mt-5 min-w-0 rounded-2xl border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.94))] p-4 sm:p-5">
          {currentStepQuestion && <p className="whitespace-pre-line break-words text-sm leading-7 text-slate-100 sm:text-base">{currentStepQuestion}</p>}
          {!currentStepQuestion && currentStepExplanation && (
            <p className="whitespace-pre-line break-words text-sm leading-7 text-slate-100 sm:text-base">{currentStepExplanation}</p>
          )}

          {currentStep.stepType === "concept" && (
            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{UI.conceptCard}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{currentConceptTitle}</h3>
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-cyan-50/90">{currentConceptDescription}</p>
            </div>
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
                    className={`min-h-11 w-full rounded-2xl border px-4 py-3 text-left text-sm leading-6 whitespace-normal break-words transition ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-slate-700 bg-slate-950/60 text-slate-200 hover:border-slate-500"
                    }`}
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
                    className={`flex min-h-11 w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-6 whitespace-normal break-words transition ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-slate-700 bg-slate-950/60 text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                      active ? "border-yellow-300 bg-yellow-300 text-slate-950" : "border-slate-500 text-transparent"
                    }`}>
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
              <input
                value={sanitizeInputAnswer(inputAnswer)}
                onChange={(event) => setInputAnswer(sanitizeInputAnswer(event.target.value))}
                placeholder={displayInlineText(currentStep.inputPlaceholder, UI.answerPlaceholder)}
                inputMode={currentStep.answerType === "number" ? "decimal" : "text"}
                className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
          )}

          {(currentStep.stepType === "choice" || currentStep.stepType === "input" || currentStep.stepType === "multi_select") && (
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
                className="min-h-11 w-full rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isSubmitting ? UI.submitting : UI.submit}
              </button>
            </div>
          )}

          {(nextHint || activeHint) && (
            <div className="mt-6 space-y-3">
              {nextHint && (
                <button
                  type="button"
                  onClick={revealNextHint}
                  className="min-h-11 rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  {nextHint.buttonLabel}
                </button>
              )}
              {activeHint && (
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-100/80">{activeHint.label}</p>
                  <p className="mt-2 whitespace-pre-line break-words leading-6">{displayBlockText(activeHint.text)}</p>
                </div>
              )}
            </div>
          )}

          {currentProgress?.submitted && (
            <>
              <div
                className={`mt-6 rounded-2xl border p-4 text-sm ${
                  currentProgress.isCorrect
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-red-500/30 bg-red-500/10 text-red-100"
                }`}
              >
                <p className="font-semibold">{currentProgress.isCorrect ? UI.correct : UI.retry}</p>
                <p className="mt-2 whitespace-pre-line break-words leading-6">{feedbackMessage}</p>
              </div>
              {currentExplanationText && (
                <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">{UI.solutionTitle}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/75">
                    {currentProgress.isCorrect ? UI.solutionSummary : UI.solutionKeyConcept}
                  </p>
                  <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.summary}</p>

                  {!currentProgress.isCorrect && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/30 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/75">{UI.solutionConcept}</p>
                        <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.concept}</p>
                      </div>
                      {currentSolution.commonMistake && (
                        <div className="rounded-2xl border border-amber-300/20 bg-slate-950/30 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/80">{UI.solutionMistake}</p>
                          <p className="mt-2 whitespace-pre-line break-words leading-6 text-amber-50">{currentSolution.commonMistake}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(currentProgress.isCorrect || canRevealFullSolution) && (
                    <button
                      type="button"
                      onClick={toggleCurrentSolution}
                      className="mt-4 min-h-11 rounded-2xl border border-cyan-300/30 bg-slate-950/30 px-4 py-2 text-sm font-semibold text-cyan-50"
                    >
                      {isSolutionOpen ? UI.solutionDetailsClose : UI.solutionDetailsOpen}
                    </button>
                  )}

                  {!currentProgress.isCorrect && !canRevealFullSolution && (
                    <p className="mt-4 text-sm leading-6 text-cyan-50/85">
                      힌트를 더 보면서 다시 생각해 보세요. 마지막 힌트까지 보면 자세한 풀이도 열 수 있어요.
                    </p>
                  )}

                  {isSolutionOpen && (currentProgress.isCorrect || canRevealFullSolution) && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-3">
                        {currentSolution.steps.map((item, index) => (
                          <div key={`${currentStepIndex}:solution:${index}`} className="rounded-2xl border border-cyan-300/20 bg-slate-950/30 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/75">{`STEP ${index + 1}`}</p>
                            <p className="mt-2 whitespace-pre-line break-words leading-6">{item}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/30 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/75">{UI.solutionConcept}</p>
                        <p className="mt-2 whitespace-pre-line break-words leading-6">{currentSolution.concept}</p>
                      </div>
                      {currentSolution.commonMistake && (
                        <div className="rounded-2xl border border-amber-300/20 bg-slate-950/30 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/80">{UI.solutionMistake}</p>
                          <p className="mt-2 whitespace-pre-line break-words leading-6 text-amber-50">{currentSolution.commonMistake}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {saveNotice && <p className="mt-4 text-sm text-red-300">{saveNotice}</p>}
        </div>

        <div className="sticky bottom-3 z-20 mt-6 grid grid-cols-1 gap-3 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-3 backdrop-blur sm:grid-cols-2">
          <button
            type="button"
            onClick={showReplayActions ? handleReplay : handlePrev}
            disabled={showReplayActions ? false : currentStepIndex === 0 || isCompleting || isSubmitting}
            className="min-h-11 rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="min-h-11 rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLastStep ? (sessionCompleted ? (isCompleting ? UI.processing : UI.backToList) : UI.next) : UI.next}
          </button>
        </div>
      </section>

      {sessionCompleted && (
        <section className="mt-6 rounded-3xl border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(4,47,46,0.45),rgba(2,6,23,0.92))] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">{UI.summaryTitle}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{UI.completionTitle}</h2>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">
              {`+${displayedEarnedXp} XP`}
            </span>
          </div>

          {completionMeta?.leveledUp && (
            <div className="mt-5 rounded-2xl border border-yellow-300/30 bg-yellow-400/10 p-4 text-yellow-50">
              <p className="text-sm font-semibold">{`${UI.levelUpTitle} Lv.${completionMeta.currentLevel}`}</p>
              <p className="mt-2 break-words text-sm leading-6">{UI.levelUpDescription}</p>
            </div>
          )}
          {missionFeedback && (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{UI.resultTitle}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{`${Math.round(missionFeedback.accuracy * 100)}%`}</p>
                  <p className="mt-2 text-sm text-slate-300">{`${missionFeedback.correctSteps} / ${missionFeedback.gradableSteps} ${UI.gradableInfo}`}</p>
                </div>
                <div className="max-w-md space-y-3 text-sm text-slate-200">
                  <div>
                    <p className="font-semibold text-white">{UI.strengthsLabel}</p>
                    <p className="mt-1 break-words leading-6">{missionFeedback.strengthMessage}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{UI.reviewLabel}</p>
                    <p className="mt-1 break-words leading-6">{missionFeedback.reviewMessage}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{UI.wrongSummaryLabel}</p>
                {missionFeedback.incorrectStepSummaries.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {missionFeedback.incorrectStepSummaries.map((item) => (
                      <div key={`${item.stepOrder}:${item.title}`} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="text-sm font-semibold text-white">{`${item.stepOrder}. ${displayInlineText(item.title)}`}</p>
                        <p className="mt-2 break-words text-sm leading-6 text-slate-300">{displayBlockText(item.summary)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-300">{UI.noWrongSummary}</p>
                )}
              </div>
            </div>
          )}

          {missionFeedback && missionFeedback.newlyEarnedBadges.length > 0 && (
            <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">{UI.badgeEarnedLabel}</p>
                <p className="mt-2 text-lg font-semibold text-white">{UI.badgeEarnedTitle}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {missionFeedback.newlyEarnedBadges.map((badge) => (
                  <div key={`${badge.key}:${badge.earnedAt}`} className="rounded-2xl border border-emerald-400/20 bg-slate-950/50 p-4">
                    <p className="text-sm font-semibold text-white">{badge.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{badge.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">{UI.summaryQuestion}</p>
              <p className="mt-3 text-sm leading-6 text-slate-100">{mission.essentialQuestion}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">{UI.summaryConcept}</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-100">{mission.conceptSummary}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">{UI.summaryGoal}</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-100">{mission.learningGoal}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{UI.summarySteps}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {steps.map((step) => (
                <span key={step.stepOrder} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                  {displayInlineText(step.title, `${UI.currentStep} ${step.stepOrder}`)}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">{UI.nextGoalTitle}</p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {completionMeta ? `${UI.nextLevelRemaining} ${completionMeta.xpToNextLevel}${UI.xpRemainingSuffix}` : `${UI.nextLevelRemaining} 0${UI.xpRemainingSuffix}`}
                </p>
                <p className="mt-2 text-sm leading-6 text-cyan-50/90">{UI.nextGoalDescription}</p>
              </div>
              <span className="rounded-full border border-cyan-300/30 bg-slate-950/40 px-4 py-2 text-sm text-cyan-50">
                {UI.nextMissionHint}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Link href="/student/math" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-slate-950/40 px-4 py-3 text-sm font-semibold text-emerald-50">
              {UI.home}
            </Link>
            <button type="button" onClick={handleReplay} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950">
              {UI.replay}
            </button>
          </div>
          {learningPoints.length > 0 && (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="space-y-2 text-sm text-slate-200">
                {learningPoints.map((point) => (
                  <p key={point} className="leading-6">{`- ${point}`}</p>
                ))}
              </div>
            </div>
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
