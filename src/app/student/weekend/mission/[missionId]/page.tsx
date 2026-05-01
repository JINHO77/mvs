"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  completeMissionAttemptWithFeedback,
  fetchAnyMissionById,
  fetchMissionProgress,
  getOrCreateActiveMissionAttempt,
  getStudentMissionStats,
  saveMissionStepResult,
} from "@/lib/missions";
import type { MissionCompletionFeedback, MissionProgressSummary } from "@/lib/missions";
import BadgeUnlockToast from "@/components/badges/BadgeUnlockToast";
import {
  areSameNumberSet,
  buildInputStepRetryMessage,
  buildMissionExplanation,
  buildMissionHintSequence,
  buildMissionSolution,
  isEquivalentAnswer,
  shouldRevealFullSolution,
} from "@/lib/missionAnswers";
import { normalizeUiText } from "@/lib/uiText";
import type { MissionStep } from "@/types/missions";

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function decodeUnicode(text?: string | null): string {
  if (typeof text !== "string") return "";
  if (!text.includes("\\u")) return text;
  try { return JSON.parse(`"${text}"`) as string; } catch { return text; }
}

function displayInlineText(value: string | null | undefined, fallback = ""): string {
  return normalizeUiText(decodeUnicode(value)) || fallback;
}

function displayBlockText(value: string | null | undefined, fallback = ""): string {
  const decoded = decodeUnicode(value)
    .replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n")
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const text = decoded.split("\n").map((l) => normalizeUiText(l)).filter(Boolean).join("\n");
  return text || fallback;
}

function sanitizeInputAnswer(value: string | null | undefined): string {
  const decoded = decodeUnicode(value);
  if (!decoded || decoded.includes("\\u") || decoded === "???") return "";
  return decoded;
}

function isCorrectStepAnswer(step: MissionStep, answer: string): boolean {
  return isEquivalentAnswer(answer, step.correctAnswer, step);
}

function missionXpForDifficulty(_value: string): number { return 100; }

function difficultyLabel(v: string) {
  if (v === "easy") return "쉬움";
  if (v === "challenge" || v === "hard") return "도전";
  return "보통";
}

function difficultyBadgeClass(v: string) {
  if (v === "easy") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (v === "challenge" || v === "hard") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
}

function stepTypeLabel(t: MissionStep["stepType"]) {
  if (t === "choice") return "선택형";
  if (t === "multi_select") return "복수 선택";
  if (t === "input") return "직접 입력";
  if (t === "writing") return "작성형";
  if (t === "concept") return "개념 학습";
  return "도입";
}

function isGradableStep(s: MissionStep | null) {
  return s?.stepType === "choice" || s?.stepType === "input" || s?.stepType === "multi_select";
}
function isWritingStep(s: MissionStep | null) {
  return s?.stepType === "writing" || s?.answerType === "writing";
}
function requiresStepSubmission(s: MissionStep | null) {
  return isGradableStep(s) || isWritingStep(s);
}

function buildWritingGuide(s: MissionStep | null): string[] {
  if (s?.writingGuide?.length) return s.writingGuide.map((i) => decodeUnicode(i)).filter(Boolean);
  return [
    "1. 주제에서 구해야 하는 것을 한 문장으로 써 보세요.",
    "2. 필요한 조건이나 근거를 정리해 보세요.",
    "3. 판단 과정을 순서대로 설명해 보세요.",
    "4. 마지막에 결론을 짧게 정리해 보세요.",
  ];
}
function buildWritingExpressions(s: MissionStep | null): string[] {
  if (s?.keyExpressions?.length) return s.keyExpressions.map((i) => decodeUnicode(i)).filter(Boolean);
  return ["먼저", "따라서", "즉", "왜냐하면", "결론적으로"];
}
function buildWritingCommonMistakes(s: MissionStep | null): string[] {
  const sc = s as (MissionStep & { scoringCriteria?: string[] }) | null;
  if (sc?.scoringCriteria?.length) return sc.scoringCriteria.map((i) => decodeUnicode(i)).filter(Boolean);
  if (s?.commonMistakes?.length) return s.commonMistakes.map((i) => decodeUnicode(i)).filter(Boolean);
  return ["결론만 쓰고 근거를 빠뜨리는 경우", "감정만 쓰고 논리적 설명이 없는 경우"];
}
function buildWritingSample(s: MissionStep | null): string {
  return displayBlockText(s?.sampleAnswer, "예: 먼저 주제를 파악합니다.\n관련 근거나 이유를 찾습니다.\n이를 바탕으로 내 생각을 설명합니다.\n따라서 결론을 정리할 수 있습니다.");
}
function buildWritingPlaceholder(s: MissionStep | null): string {
  return decodeUnicode(s?.inputPlaceholder) || `여기에 ${s?.expectedSentenceCount ?? 3}문장 정도로 작성해 보세요.`;
}
function buildLearningPoints(mission: MissionPresentation | null, steps: MissionStep[]): string[] {
  if (!mission) return [];
  return Array.from(new Set([
    mission.learningGoal, mission.conceptSummary, mission.essentialQuestion,
    ...steps.filter((s) => s.stepType === "concept").map((s) => displayInlineText(s.conceptTitle ?? s.title)),
  ])).filter(Boolean).slice(0, 5);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function WeekendMissionPage() {
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
  const [infoExpanded, setInfoExpanded] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    async function loadMission() {
      if (!missionId) { setError("미션 ID가 없습니다."); setLoading(false); return; }
      setLoading(true); setError(null); setSaveNotice(null);
      try {
        const loaded = await fetchAnyMissionById(missionId);
        if (!mounted) return;
        if (!loaded) { setError("미션을 찾을 수 없습니다."); setLoading(false); return; }
        const payload = loaded.mission_json;
        const totalSteps = payload.steps.length;
        const [attempt, missionProgress] = await Promise.all([
          getOrCreateActiveMissionAttempt(missionId),
          fetchMissionProgress(missionId, totalSteps),
        ]);
        if (!mounted) return;
        setMission({
          title: displayInlineText(payload.title, displayInlineText(loaded.title, "제목 없음")),
          scenario: displayBlockText(payload.scenario, displayInlineText(loaded.title, "상황 설명이 없습니다.")),
          essentialQuestion: displayInlineText(payload.essentialQuestion, "핵심 질문을 준비 중입니다."),
          conceptSummary: displayBlockText(payload.conceptSummary, "개념 요약이 없습니다."),
          learningGoal: displayBlockText(payload.learningGoal ?? payload.essentialQuestion, "학습 목표를 준비 중입니다."),
          difficulty: payload.difficulty ?? loaded.difficulty,
          estimatedMinutes: payload.estimatedMinutes ?? loaded.estimated_minutes,
          unitId: loaded.unit_id ?? null,
        });
        setSteps(payload.steps);
        attemptIdRef.current = attempt.id;
        studentIdRef.current = attempt.student_id;
        setAttemptId(attempt.id);
        setHistoricalAttemptStatus(missionProgress);
        setSelectedChoice(""); setSelectedMultiChoices([]); setInputAnswer("");
        setHintStageMap({}); setStepProgressMap({});
        setSessionCompleted(false); setCompletionMeta(null); setMissionFeedback(null);
        setAnimatedEarnedXp(0); setSolutionOpenMap({});
        setCurrentStepIndex(0);
        stepStartedAtRef.current = Date.now();
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "미션을 불러오지 못했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadMission();
    return () => { mounted = false; };
  }, [missionId]);

  useEffect(() => { attemptIdRef.current = attemptId; }, [attemptId]);

  useEffect(() => {
    setSelectedChoice(""); setSelectedMultiChoices([]); setInputAnswer("");
    setSaveNotice(null);
    stepStartedAtRef.current = Date.now();
  }, [currentStepIndex]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentStep = useMemo(() => steps[currentStepIndex] ?? null, [currentStepIndex, steps]);
  const currentProgress = stepProgressMap[currentStepIndex];
  const isLastStep = steps.length > 0 && currentStepIndex === steps.length - 1;
  const showReplayActions = sessionCompleted && isLastStep;
  const currentDisplayStep = steps.length > 0 ? currentStepIndex + 1 : 0;
  const hasHistoricalCompletion = historicalAttemptStatus?.status === "completed";
  const requiresSubmission = requiresStepSubmission(currentStep);
  const progressPercent = steps.length > 0
    ? Math.min(100, Math.max(0, Math.round(((sessionCompleted ? steps.length : currentDisplayStep) / steps.length) * 100)))
    : 0;
  const learningPoints = useMemo(() => buildLearningPoints(mission, steps), [mission, steps]);
  const currentStepTitle = displayInlineText(currentStep?.title, `단계 ${currentDisplayStep || 1}`);
  const currentStepQuestion = displayBlockText(currentStep?.question, displayBlockText(currentStep?.explanation));
  const currentStepExplanation = displayBlockText(currentStep?.explanation);
  const currentIsWritingStep = isWritingStep(currentStep);
  const writingGuide = currentIsWritingStep ? buildWritingGuide(currentStep) : [];
  const writingExpressions = currentIsWritingStep ? buildWritingExpressions(currentStep) : [];
  const writingCommonMistakes = currentIsWritingStep ? buildWritingCommonMistakes(currentStep) : [];
  const writingSample = currentIsWritingStep ? buildWritingSample(currentStep) : "";
  const writingSentenceTarget = currentStep?.expectedSentenceCount ?? 3;
  const writingSentenceCount = inputAnswer.split(/[.!?]\s+|\n+/).map((i) => i.trim()).filter(Boolean).length;
  const writingCharacterCount = inputAnswer.trim().length;
  const currentConceptTitle = displayInlineText(currentStep?.conceptTitle ?? currentStep?.title, "개념 포인트");
  const currentConceptDescription = displayBlockText(
    currentStep?.conceptDescription ?? currentStep?.explanation,
    mission?.conceptSummary ?? "개념 요약이 없습니다."
  );
  const hintSequence = currentIsWritingStep
    ? [
        { level: 1 as const, label: "힌트 1", buttonLabel: "힌트 1 보기", text: writingGuide.join("\n") },
        { level: 2 as const, label: "힌트 2", buttonLabel: "힌트 2 보기", text: writingExpressions.map((i) => `- ${i}`).join("\n") },
        { level: 3 as const, label: "힌트 3", buttonLabel: "힌트 3 보기", text: writingSample },
      ]
    : buildMissionHintSequence(currentStep, {
        subject: "english",
        conceptSummary: mission?.conceptSummary ?? null,
        missionTitle: mission?.title ?? null,
        scenario: mission?.scenario ?? null,
      });
  const revealedHintStage = hintStageMap[currentStepIndex] ?? 0;
  const activeHint = revealedHintStage > 0 ? hintSequence[Math.min(revealedHintStage, hintSequence.length) - 1] ?? null : null;
  const nextHint = revealedHintStage < hintSequence.length ? hintSequence[revealedHintStage] : null;
  const currentExplanationText = currentIsWritingStep
    ? "좋은 풀이 설명은 목표, 근거, 과정, 결론이 순서대로 보입니다."
    : displayBlockText(buildMissionExplanation(currentStep, {
        subject: "english",
        conceptSummary: mission?.conceptSummary ?? null,
        missionTitle: mission?.title ?? null,
        scenario: mission?.scenario ?? null,
      }));
  const currentSolution = currentIsWritingStep
    ? { summary: "좋은 작성 답안은 주장, 근거, 결론이 분명합니다.", steps: writingGuide, concept: writingExpressions.join(", "), commonMistake: writingCommonMistakes[0] }
    : buildMissionSolution(currentStep, {
        subject: "english",
        conceptSummary: mission?.conceptSummary ?? null,
        missionTitle: mission?.title ?? null,
        scenario: mission?.scenario ?? null,
      });
  const isSolutionOpen = solutionOpenMap[currentStepIndex] ?? false;
  const currentHintUsedCount = hintStageMap[currentStepIndex] ?? 0;
  const canRevealFullSolution = shouldRevealFullSolution(currentProgress?.isCorrect === true, currentHintUsedCount);
  const fallbackRetryMessage = buildInputStepRetryMessage(
    currentStep, currentProgress?.submittedAnswer ?? inputAnswer, currentStep?.correctAnswer, { subject: "english" }
  );
  const feedbackMessage = currentIsWritingStep
    ? "내 생각을 잘 표현했어요. 아래 풀이 가이드를 참고해 더 다듬어 보세요."
    : currentProgress?.isCorrect
      ? displayBlockText(currentStep?.feedbackCorrect ?? currentExplanationText, "정답입니다.")
      : displayBlockText(currentStep?.feedbackIncorrect ?? fallbackRetryMessage, fallbackRetryMessage);
  const displayedEarnedXp = sessionCompleted
    ? animatedEarnedXp
    : (completionMeta?.earnedXp ?? missionXpForDifficulty(mission?.difficulty ?? "normal"));

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionCompleted || !completionMeta || completionMeta.earnedXp <= 0) { setAnimatedEarnedXp(0); return; }
    const target = completionMeta.earnedXp;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const p = Math.min(1, frame / 18);
      setAnimatedEarnedXp(Math.round(target * p));
      if (p >= 1) window.clearInterval(timer);
    }, 45);
    return () => window.clearInterval(timer);
  }, [completionMeta, sessionCompleted]);

  useEffect(() => {
    if (!missionFeedback || missionFeedback.newlyEarnedBadges.length === 0) { setBadgeToastVisible(false); return; }
    setBadgeToastVisible(true);
    const t = window.setTimeout(() => setBadgeToastVisible(false), 4800);
    return () => window.clearTimeout(t);
  }, [missionFeedback]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function getTimeSpent() { return Math.max(1, Math.round((Date.now() - stepStartedAtRef.current) / 1000)); }

  function revealNextHint() {
    setHintStageMap((cur) => {
      const stage = cur[currentStepIndex] ?? 0;
      if (stage >= hintSequence.length) return cur;
      return { ...cur, [currentStepIndex]: (stage + 1) as 1 | 2 | 3 };
    });
  }

  function handleReplay() {
    setCurrentStepIndex(0); setSelectedChoice(""); setSelectedMultiChoices([]); setInputAnswer("");
    setHintStageMap({}); setStepProgressMap({}); setSaveNotice(null);
    setSessionCompleted(false); setCompletionMeta(null); setMissionFeedback(null);
    setAnimatedEarnedXp(0); setSolutionOpenMap({});
    stepStartedAtRef.current = Date.now();
  }

  function toggleMultiChoice(i: number) {
    setSelectedMultiChoices((cur) =>
      cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b)
    );
  }

  async function applyCompletionMeta(feedback: MissionCompletionFeedback) {
    const stats = await getStudentMissionStats("math");
    setCompletionMeta({
      earnedXp: feedback.earnedXp,
      baseXp: missionXpForDifficulty(mission?.difficulty ?? "normal"),
      hintUsedCount: feedback.hintUsedCount,
      xpMessage: feedback.xpMessage,
      todayGoalAchieved: stats.todayCompletedCount >= 1,
      weeklyGoalAchieved: stats.weeklyCompletedCount >= 5,
      xpToNextLevel: feedback.xpToNextLevel,
      currentLevel: feedback.level,
      leveledUp: feedback.leveledUp,
    });
  }

  async function finalizeMission() {
    const aid = attemptIdRef.current ?? attemptId;
    if (!aid || !mission) return;
    setIsCompleting(true); setSaveNotice(null);
    try {
      const feedback = await completeMissionAttemptWithFeedback({
        attemptId: aid, missionId, unitId: mission.unitId, steps,
        hintUsedCount: Object.values(hintStageMap).reduce((s, c) => s + c, 0 as number),
      });
      await applyCompletionMeta(feedback);
      setMissionFeedback(feedback);
      setSessionCompleted(true);
      setHistoricalAttemptStatus((prev) => ({
        missionId, attemptId: aid, status: "completed",
        lastStep: steps.length, totalSteps: prev?.totalSteps ?? steps.length,
      }));
    } catch (e) {
      console.error("[WeekendMissionPage] completion failed", e);
      setSaveNotice("미션 완료 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleAdvance() {
    const aid = attemptIdRef.current ?? attemptId;
    if (!currentStep || !aid) return;
    if (currentStepIndex < steps.length - 1) { setCurrentStepIndex((p) => p + 1); return; }
    await finalizeMission();
  }

  function handlePrev() { if (currentStepIndex > 0) setCurrentStepIndex((p) => p - 1); }

  async function submitCurrentStep(answer: string, indexes?: number[]) {
    const aid = attemptIdRef.current ?? attemptId;
    if (!currentStep || !aid || !requiresStepSubmission(currentStep)) return;
    const normalized =
      currentStep.stepType === "choice" ? answer
      : currentStep.stepType === "multi_select" ? JSON.stringify([...(indexes ?? [])].sort((a, b) => a - b))
      : sanitizeInputAnswer(answer).trim();
    if (!normalized) return;
    const isCorrect = currentIsWritingStep ? null
      : currentStep.stepType === "multi_select" ? areSameNumberSet(indexes ?? [], currentStep.correctChoiceIndexes ?? [])
      : isCorrectStepAnswer(currentStep, normalized);
    const hintUsed = (hintStageMap[currentStepIndex] ?? 0) > 0;
    setIsSubmitting(true); setSaveNotice(null);
    try {
      await saveMissionStepResult({
        attemptId: aid, missionId, stepOrder: currentStep.stepOrder,
        stepType: currentStep.stepType, studentAnswer: normalized,
        isCorrect, hintUsed, timeSpentSeconds: getTimeSpent(),
      });
      setStepProgressMap((prev) => ({
        ...prev,
        [currentStepIndex]: {
          submitted: true, isCorrect, submittedAnswer: normalized,
          submittedChoiceIndexes: currentStep.stepType === "multi_select" ? [...(indexes ?? [])] : undefined,
        },
      }));
    } catch (e) {
      console.error("[WeekendMissionPage] step save failed", e);
      setSaveNotice("답안 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render: loading / error / empty ───────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf0f5] to-[#f0e0eb] dark:from-[#0b1220] dark:to-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#D4537E]/20 dark:border-[#facc15]/20 border-t-[#D4537E] dark:border-t-[#facc15] animate-spin mx-auto mb-4" />
          <p className="text-[#D4537E] dark:text-[#facc15] font-medium text-sm">미션을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf0f5] to-[#f0e0eb] dark:from-[#0b1220] dark:to-[#0f172a] flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">😔</div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">미션을 불러오지 못했어요</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/student")}
            className="px-6 py-3 bg-gradient-to-r from-[#D4537E] to-[#c43d6a] dark:from-[#facc15] dark:to-[#f59e0b] text-white dark:text-[#0b1220] rounded-2xl font-medium text-sm"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!mission || !currentStep) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf0f5] to-[#f0e0eb] dark:from-[#0b1220] dark:to-[#0f172a] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🌱</div>
          <p className="text-gray-500 dark:text-gray-400">{mission?.title || "미션을 준비 중이에요"}</p>
          <p className="text-sm text-gray-400 mt-2">등록된 단계가 없습니다.</p>
        </div>
      </div>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-[#fdf0f5] to-[#f0e0eb] dark:from-[#0b1220] dark:to-[#0f172a] pb-32">
        <div className="max-w-[680px] mx-auto px-4">

          {/* Back */}
          <div className="pt-6 pb-1">
            <button
              onClick={() => router.push("/student")}
              className="text-sm text-[#D4537E]/70 dark:text-[#facc15]/60 hover:text-[#D4537E] dark:hover:text-[#facc15] transition-colors"
            >
              ← 홈으로
            </button>
          </div>

          {/* ── Header ── */}
          <div className="py-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4537E] dark:text-[#facc15] uppercase">
                ✨ WEEKEND CHALLENGE
              </span>
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${difficultyBadgeClass(mission.difficulty)}`}>
                {difficultyLabel(mission.difficulty)}
              </span>
              {hasHistoricalCompletion && !sessionCompleted && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#D4537E]/10 dark:bg-[#facc15]/10 text-[#D4537E] dark:text-[#facc15]">
                  🔁 이미 완료한 미션 · 연습 모드 (XP 없음)
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-white leading-tight">
              {mission.title}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {mission.essentialQuestion}
            </p>

            {/* Dot progress */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {steps.map((_, i) => {
                  const done = sessionCompleted ? true : i < currentStepIndex;
                  const cur = !sessionCompleted && i === currentStepIndex;
                  return (
                    <div key={i} className={`rounded-full transition-all duration-300 ${
                      done
                        ? "w-3 h-3 bg-[#D4537E] dark:bg-[#facc15]"
                        : cur
                          ? "w-3 h-3 border-2 border-[#D4537E] dark:border-[#facc15] bg-[#D4537E]/20 dark:bg-[#facc15]/20 animate-pulse"
                          : "w-2.5 h-2.5 bg-[#D4537E]/15 dark:bg-slate-600"
                    }`} />
                  );
                })}
                <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {sessionCompleted ? steps.length : currentDisplayStep}/{steps.length}단계
                </span>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">
                약 {mission.estimatedMinutes ?? 10}분
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-[#D4537E]/10 dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#D4537E] to-[#c43d6a] dark:from-[#facc15] dark:to-[#f59e0b] transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* ── Collapsible info ── */}
          <div className="mb-5">
            <button
              onClick={() => setInfoExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/50 dark:bg-white/5 border border-[#D4537E]/10 dark:border-[#facc15]/10 text-sm hover:bg-white/70 dark:hover:bg-white/8 transition-all"
            >
              <span className="font-medium text-[#D4537E] dark:text-[#facc15]">📚 미션 정보</span>
              <span className="text-xs text-gray-400">{infoExpanded ? "접기 ▲" : "펼치기 ▼"}</span>
            </button>

            {infoExpanded && (
              <div className="mt-2 backdrop-blur-md bg-white/60 dark:bg-[#1a2035]/50 border border-[#D4537E]/10 dark:border-[#facc15]/10 rounded-2xl p-4 space-y-4">
                {[
                  { label: "상황", text: mission.scenario },
                  { label: "개념 요약", text: mission.conceptSummary },
                  { label: "학습 목표", text: mission.learningGoal },
                ].map(({ label, text }) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold tracking-widest text-[#D4537E]/60 dark:text-[#facc15]/60 uppercase mb-1">{label}</p>
                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Completion banner ── */}
          {sessionCompleted && missionFeedback?.isPractice && (
            <div className="mb-5 p-5 rounded-3xl bg-gradient-to-r from-[#D4537E]/10 to-[#c43d6a]/5 dark:from-[#facc15]/10 dark:to-[#f59e0b]/5 border border-[#D4537E]/20 dark:border-[#facc15]/20">
              <p className="text-[10px] font-bold tracking-widest text-[#D4537E] dark:text-[#facc15] uppercase mb-1">연습 완료 👏</p>
              <p className="font-semibold text-gray-800 dark:text-white">
                {missionFeedback.firstClearedAt
                  ? `${new Date(missionFeedback.firstClearedAt).toLocaleDateString("ko-KR")}에 이미 클리어한 미션이라 XP는 지급되지 않아요.`
                  : "이미 클리어한 미션이라 XP는 지급되지 않아요."}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">실력 점검 잘 했어요!</p>
            </div>
          )}
          {sessionCompleted && !missionFeedback?.isPractice && (
            <div className="mb-5 p-5 rounded-3xl bg-gradient-to-r from-[#D4537E]/10 to-[#c43d6a]/5 dark:from-[#facc15]/10 dark:to-[#f59e0b]/5 border border-[#D4537E]/20 dark:border-[#facc15]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#D4537E] dark:text-[#facc15] uppercase mb-1">미션 완료 🎉</p>
                  <p className="font-semibold text-gray-800 dark:text-white">모든 단계를 마쳤어요!</p>
                  {completionMeta?.xpMessage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{completionMeta.xpMessage}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-[#D4537E] dark:text-[#facc15]">+{displayedEarnedXp}</p>
                  <p className="text-xs text-gray-500">XP 획득</p>
                </div>
              </div>
              {missionFeedback && missionFeedback.hintUsedCount > 0 && missionFeedback.hintPenaltyPct > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {`💡 힌트 ${missionFeedback.hintUsedCount}개 사용 — XP ${missionFeedback.hintPenaltyPct}% 차감`}
                </p>
              )}
              {completionMeta?.leveledUp && (
                <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  <span>⭐</span>
                  <span>레벨업! Lv.{completionMeta.currentLevel}에 도달했어요</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step card ── */}
          <div className="backdrop-blur-md bg-white/70 dark:bg-[#1a2035]/60 border border-[#D4537E]/15 dark:border-white/5 rounded-3xl p-6 shadow-lg shadow-[#D4537E]/5 dark:shadow-black/20">

            {/* Step header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D4537E]/60 dark:text-[#facc15]/60 mb-1">
                  {currentDisplayStep} / {steps.length} 단계
                </p>
                <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-white leading-snug">
                  {currentStepTitle}
                </h2>
              </div>
              <span className="flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#D4537E]/10 dark:bg-[#facc15]/10 text-[#D4537E] dark:text-[#facc15]">
                {stepTypeLabel(currentStep.stepType)}
              </span>
            </div>

            {/* Question */}
            {currentStepQuestion && (
              <p className="text-[1.05rem] leading-[1.85] text-[#1a1a2e] dark:text-gray-100 whitespace-pre-line break-words mb-5">
                {currentStepQuestion}
              </p>
            )}
            {!currentStepQuestion && currentStepExplanation && (
              <p className="text-[1.05rem] leading-[1.85] text-[#1a1a2e] dark:text-gray-100 whitespace-pre-line break-words mb-5">
                {currentStepExplanation}
              </p>
            )}

            {/* Concept card */}
            {currentStep.stepType === "concept" && (
              <div className="mt-2 p-5 rounded-2xl bg-[#D4537E]/5 dark:bg-[#facc15]/5 border border-[#D4537E]/15 dark:border-[#facc15]/15">
                <p className="text-[10px] font-bold tracking-widest text-[#D4537E] dark:text-[#facc15] uppercase mb-2">개념 포인트</p>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-2">{currentConceptTitle}</h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line break-words">
                  {currentConceptDescription}
                </p>
              </div>
            )}

            {/* Single choice */}
            {currentStep.stepType === "choice" && currentStep.choices && (
              <div className="space-y-2.5">
                {currentStep.choices.map((choice, idx) => {
                  const label = displayInlineText(choice);
                  const active = selectedChoice === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSelectedChoice(choice)}
                      style={{ transitionDelay: `${idx * 40}ms` }}
                      className={`w-full text-left px-5 py-4 rounded-2xl border text-sm leading-relaxed transition-all duration-200 whitespace-normal break-words flex items-center gap-3 ${
                        active
                          ? "bg-gradient-to-r from-[#D4537E]/15 to-[#D4537E]/5 dark:from-[#facc15]/15 dark:to-[#facc15]/5 border-2 border-[#D4537E] dark:border-[#facc15] text-[#1a1a2e] dark:text-white font-medium"
                          : "bg-white/60 dark:bg-white/5 border-[#D4537E]/15 dark:border-white/5 text-gray-700 dark:text-gray-200 hover:bg-[#D4537E]/5 dark:hover:bg-[#facc15]/5 hover:border-[#D4537E]/40 dark:hover:border-[#facc15]/40 hover:translate-x-1"
                      }`}
                    >
                      <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full transition-all ${
                        active ? "bg-[#D4537E] dark:bg-[#facc15]" : "bg-[#D4537E]/20 dark:bg-[#facc15]/20"
                      }`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Multi select */}
            {currentStep.stepType === "multi_select" && currentStep.choices && (
              <div className="space-y-2.5">
                {currentStep.choices.map((choice, index) => {
                  const label = displayInlineText(choice);
                  const active = selectedMultiChoices.includes(index);
                  return (
                    <button
                      key={`${choice}:${index}`}
                      type="button"
                      onClick={() => toggleMultiChoice(index)}
                      style={{ transitionDelay: `${index * 40}ms` }}
                      className={`w-full text-left px-5 py-4 rounded-2xl border text-sm leading-relaxed transition-all duration-200 flex items-start gap-3 whitespace-normal break-words ${
                        active
                          ? "bg-gradient-to-r from-[#D4537E]/15 to-[#D4537E]/5 dark:from-[#facc15]/15 dark:to-[#facc15]/5 border-2 border-[#D4537E] dark:border-[#facc15] text-[#1a1a2e] dark:text-white font-medium"
                          : "bg-white/60 dark:bg-white/5 border-[#D4537E]/15 dark:border-white/5 text-gray-700 dark:text-gray-200 hover:bg-[#D4537E]/5 dark:hover:bg-[#facc15]/5 hover:border-[#D4537E]/40 dark:hover:border-[#facc15]/40 hover:translate-x-1"
                      }`}
                    >
                      <span className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs font-bold transition-all ${
                        active
                          ? "bg-[#D4537E] dark:bg-[#facc15] border-[#D4537E] dark:border-[#facc15] text-white dark:text-[#0b1220]"
                          : "border-[#D4537E]/30 dark:border-[#facc15]/30 text-transparent"
                      }`}>✓</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Input */}
            {currentStep.stepType === "input" && (
              <input
                value={sanitizeInputAnswer(inputAnswer)}
                onChange={(e) => setInputAnswer(sanitizeInputAnswer(e.target.value))}
                placeholder={displayInlineText(currentStep.inputPlaceholder, "답을 입력해 보세요.")}
                inputMode={currentStep.answerType === "number" ? "decimal" : "text"}
                className="w-full px-5 py-4 rounded-2xl border-2 border-[#D4537E]/20 dark:border-[#facc15]/20 bg-white/70 dark:bg-white/5 text-[1.05rem] text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#D4537E] dark:focus:border-[#facc15] focus:ring-4 focus:ring-[#D4537E]/10 dark:focus:ring-[#facc15]/10 transition-all"
              />
            )}

            {/* Writing */}
            {currentIsWritingStep && (
              <div className="space-y-4">
                <textarea
                  value={sanitizeInputAnswer(inputAnswer)}
                  onChange={(e) => setInputAnswer(sanitizeInputAnswer(e.target.value))}
                  placeholder={buildWritingPlaceholder(currentStep)}
                  rows={7}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-[#D4537E]/20 dark:border-[#facc15]/20 bg-white/70 dark:bg-white/5 text-[0.95rem] leading-relaxed text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#D4537E] dark:focus:border-[#facc15] focus:ring-4 focus:ring-[#D4537E]/10 dark:focus:ring-[#facc15]/10 transition-all resize-none"
                />
                <div className="flex gap-2 text-xs">
                  <span className="px-3 py-1.5 rounded-full bg-[#D4537E]/8 dark:bg-[#facc15]/10 text-[#D4537E] dark:text-[#facc15]">
                    {writingSentenceCount}/{writingSentenceTarget}문장
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500">
                    {writingCharacterCount}자
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="p-3.5 rounded-xl bg-[#D4537E]/5 dark:bg-[#facc15]/5 border border-[#D4537E]/10 dark:border-[#facc15]/10">
                    <p className="text-[10px] font-bold tracking-widest text-[#D4537E]/70 dark:text-[#facc15]/70 uppercase mb-2">작성 가이드</p>
                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      {writingGuide.map((item) => <p key={item}>{item}</p>)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/50 dark:bg-white/3 border border-gray-100 dark:border-white/5">
                    <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">핵심 표현</p>
                    <div className="flex flex-wrap gap-1.5">
                      {writingExpressions.map((item) => (
                        <span key={item} className="px-2.5 py-1 rounded-full text-xs bg-white dark:bg-white/8 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hints */}
            {(nextHint || activeHint) && (
              <div className="mt-5 space-y-3">
                {nextHint && !currentProgress?.submitted && (
                  <button
                    type="button"
                    onClick={revealNextHint}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#D4537E]/35 dark:border-[#facc15]/35 text-[#D4537E] dark:text-[#facc15] text-sm font-medium hover:bg-[#D4537E]/5 dark:hover:bg-[#facc15]/5 transition-all"
                  >
                    <span>💡</span>
                    <span>{nextHint.buttonLabel}</span>
                  </button>
                )}
                {activeHint && (
                  <div className="border-l-[3px] border-[#D4537E] dark:border-[#facc15] pl-4 py-3 bg-[#D4537E]/5 dark:bg-[#facc15]/5 rounded-r-2xl">
                    <p className="text-[11px] font-bold text-[#D4537E] dark:text-[#facc15] uppercase tracking-wider mb-1.5">{activeHint.label}</p>
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-amber-100 whitespace-pre-line break-words">
                      {displayBlockText(activeHint.text)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Submit button */}
            {(currentStep.stepType === "choice" || currentStep.stepType === "input" || currentStep.stepType === "multi_select" || currentIsWritingStep) && !currentProgress?.submitted && (
              <button
                type="button"
                onClick={() => void submitCurrentStep(
                  currentStep.stepType === "choice" ? selectedChoice
                  : currentStep.stepType === "multi_select" ? ""
                  : inputAnswer,
                  currentStep.stepType === "multi_select" ? selectedMultiChoices : undefined
                )}
                disabled={
                  isSubmitting ||
                  (currentStep.stepType === "choice" ? !selectedChoice
                  : currentStep.stepType === "multi_select" ? selectedMultiChoices.length === 0
                  : !inputAnswer.trim())
                }
                className="w-full mt-6 py-5 rounded-2xl bg-gradient-to-r from-[#D4537E] to-[#c43d6a] dark:from-[#facc15] dark:to-[#f59e0b] text-white dark:text-[#0b1220] font-semibold text-base hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#D4537E]/30 dark:hover:shadow-[#facc15]/30 transition-all duration-200 disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isSubmitting ? "제출 중..." : "제출하기"}
              </button>
            )}

            {/* Feedback */}
            {currentProgress?.submitted && (
              <div className={`mt-5 p-4 rounded-2xl border ${
                currentIsWritingStep
                  ? "border-blue-200/60 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-900/10"
                  : currentProgress.isCorrect
                    ? "border-green-200/60 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10"
                    : "border-red-200/60 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10"
              }`}>
                <p className={`font-semibold text-sm mb-1.5 ${
                  currentIsWritingStep ? "text-blue-700 dark:text-blue-300"
                  : currentProgress.isCorrect ? "text-green-700 dark:text-green-300"
                  : "text-red-600 dark:text-red-300"
                }`}>
                  {currentIsWritingStep ? "✍️ 잘 작성했어요!" : currentProgress.isCorrect ? "✅ 정답입니다!" : "❌ 다시 생각해 보세요."}
                </p>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line break-words">
                  {feedbackMessage}
                </p>
              </div>
            )}

            {/* Solution */}
            {currentProgress?.submitted && currentExplanationText && (
              <div className="mt-4 p-4 rounded-2xl bg-[#D4537E]/5 dark:bg-[#facc15]/5 border border-[#D4537E]/10 dark:border-[#facc15]/10">
                <p className="text-[10px] font-bold tracking-widest text-[#D4537E]/70 dark:text-[#facc15]/70 uppercase mb-2">풀이 이해</p>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">
                  {currentSolution.summary}
                </p>

                {!currentIsWritingStep && !currentProgress.isCorrect && !canRevealFullSolution && (
                  <p className="mt-2 text-xs text-gray-400 italic">
                    힌트를 더 보면서 다시 생각해 보세요. 마지막 힌트까지 보면 자세한 풀이도 열 수 있어요.
                  </p>
                )}

                {!currentIsWritingStep && (currentProgress.isCorrect || canRevealFullSolution) && (
                  <button
                    type="button"
                    onClick={() => setSolutionOpenMap((cur) => ({ ...cur, [currentStepIndex]: !cur[currentStepIndex] }))}
                    className="mt-3 text-xs text-[#D4537E] dark:text-[#facc15] underline underline-offset-2 hover:no-underline transition-all"
                  >
                    {isSolutionOpen ? "풀이 접기" : "풀이 자세히 보기"}
                  </button>
                )}

                {!currentIsWritingStep && isSolutionOpen && (currentProgress.isCorrect || canRevealFullSolution) && (
                  <div className="mt-3 space-y-2">
                    {currentSolution.steps.map((item, i) => (
                      <div key={`sol:${i}`} className="flex gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#D4537E]/15 dark:bg-[#facc15]/15 text-[#D4537E] dark:text-[#facc15] text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <p className="leading-relaxed whitespace-pre-line break-words">{item}</p>
                      </div>
                    ))}
                    {currentSolution.concept && (
                      <div className="mt-2 pt-2 border-t border-[#D4537E]/10 dark:border-[#facc15]/10 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-[#D4537E]/70 dark:text-[#facc15]/70">핵심 개념</span> {currentSolution.concept}
                      </div>
                    )}
                  </div>
                )}

                {currentIsWritingStep && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold text-[#D4537E]/60 dark:text-[#facc15]/60 uppercase tracking-wider mb-1">핵심 표현</p>
                      <div className="flex flex-wrap gap-1">
                        {writingExpressions.map((item) => (
                          <span key={item} className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-white/8 border border-[#D4537E]/15 dark:border-[#facc15]/15 text-gray-600 dark:text-gray-300">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[#D4537E]/60 dark:text-[#facc15]/60 uppercase tracking-wider mb-1">자주 하는 실수</p>
                      {writingCommonMistakes.slice(0, 2).map((m) => (
                        <p key={m} className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">· {m}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {saveNotice && (
              <p className="mt-4 text-sm text-red-500 dark:text-red-400">{saveNotice}</p>
            )}
          </div>

          {/* ── Completion summary ── */}
          {sessionCompleted && missionFeedback && (
            <div className="mt-5 backdrop-blur-md bg-white/60 dark:bg-[#1a2035]/50 border border-[#D4537E]/15 dark:border-[#facc15]/15 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#D4537E] dark:text-[#facc15] uppercase mb-1">풀이 결과</p>
                  <p className="text-4xl font-black text-gray-800 dark:text-white">
                    {Math.round(missionFeedback.accuracy * 100)}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {missionFeedback.correctSteps} / {missionFeedback.gradableSteps} 채점 단계 정답
                  </p>
                </div>
                <div className="text-5xl">
                  {missionFeedback.accuracy >= 0.8 ? "🌟" : missionFeedback.accuracy >= 0.5 ? "⭐" : "💪"}
                </div>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="p-3.5 rounded-2xl bg-green-50/60 dark:bg-green-900/10 border border-green-100 dark:border-green-900/25">
                  <p className="font-semibold text-green-700 dark:text-green-400 mb-1">잘한 점</p>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed break-words">{missionFeedback.strengthMessage}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/25">
                  <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">복습 제안</p>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed break-words">{missionFeedback.reviewMessage}</p>
                </div>
              </div>

              {missionFeedback.newlyEarnedBadges.length > 0 && (
                <div className="mt-4 p-3.5 rounded-2xl bg-[#D4537E]/8 dark:bg-[#facc15]/8 border border-[#D4537E]/15 dark:border-[#facc15]/15">
                  <p className="text-xs font-bold text-[#D4537E] dark:text-[#facc15] uppercase tracking-wider mb-2">🏅 새 배지 획득!</p>
                  {missionFeedback.newlyEarnedBadges.map((badge) => (
                    <div key={`${badge.key}:${badge.earnedAt}`} className="text-sm mt-1">
                      <span className="font-semibold text-gray-800 dark:text-white">{badge.name}</span>
                      <span className="text-gray-500 dark:text-gray-400"> — {badge.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {learningPoints.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">학습한 내용</p>
                  {learningPoints.map((point) => (
                    <p key={point} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">· {point}</p>
                  ))}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push("/student")}
                  className="py-3.5 rounded-2xl border-2 border-[#D4537E]/30 dark:border-[#facc15]/30 text-[#D4537E] dark:text-[#facc15] font-medium text-sm hover:border-[#D4537E] dark:hover:border-[#facc15] transition-all"
                >
                  홈으로
                </button>
                <button
                  onClick={handleReplay}
                  className="py-3.5 rounded-2xl bg-gradient-to-r from-[#D4537E] to-[#c43d6a] dark:from-[#facc15] dark:to-[#f59e0b] text-white dark:text-[#0b1220] font-semibold text-sm hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#D4537E]/30 dark:hover:shadow-[#facc15]/30 transition-all"
                >
                  다시 하기
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Sticky bottom nav ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3 bg-gradient-to-t from-[#fdf0f5] via-[#fdf0f5]/90 to-transparent dark:from-[#0b1220] dark:via-[#0b1220]/90 dark:to-transparent">
        <div className="max-w-[680px] mx-auto flex gap-3">
          <button
            type="button"
            onClick={showReplayActions ? handleReplay : handlePrev}
            disabled={showReplayActions ? false : currentStepIndex === 0 || isCompleting || isSubmitting}
            className="flex-1 py-4 rounded-2xl border-2 border-[#D4537E]/30 dark:border-[#facc15]/30 text-[#D4537E] dark:text-[#facc15] font-medium text-sm hover:border-[#D4537E] dark:hover:border-[#facc15] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {showReplayActions ? "다시 하기" : "← 이전"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLastStep && sessionCompleted) { router.push("/student"); return; }
              void handleAdvance();
            }}
            disabled={steps.length === 0 || isCompleting || isSubmitting || (requiresSubmission && !currentProgress?.submitted)}
            className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-[#D4537E] to-[#c43d6a] dark:from-[#facc15] dark:to-[#f59e0b] text-white dark:text-[#0b1220] font-semibold text-sm hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#D4537E]/30 dark:hover:shadow-[#facc15]/30 disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed transition-all"
          >
            {isCompleting ? "처리 중..." : isLastStep ? (sessionCompleted ? "홈으로" : "완료하기") : "다음 단계 →"}
          </button>
        </div>
      </div>

      {/* Badge toast */}
      {badgeToastVisible && missionFeedback && missionFeedback.newlyEarnedBadges.length > 0 && (
        <BadgeUnlockToast
          badges={missionFeedback.newlyEarnedBadges}
          onClose={() => setBadgeToastVisible(false)}
        />
      )}
    </>
  );
}
