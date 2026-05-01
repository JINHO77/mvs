export type MissionStepType =
  | "intro"
  | "input"
  | "choice"
  | "multi_select"
  | "concept"
  | "writing"
  | "self_explain"
  | "fill_in_blanks"
  | "drag_and_drop"
  | "compare";

export type MissionHint = {
  level: 1 | 2 | 3;
  text: string;
};

export type MissionSolution = {
  summary: string;
  steps: string[];
  concept: string;
  commonMistake?: string;
};

export type SelfExplainConfig = {
  prompt?: string;
  question: string;
  answer: string;
  answerType: "short" | "multiple_choice" | "number";
  choices?: string[];
  explanationPrompt: string;
  expectedKeywords: string[];
  minKeywords: number;
  minLength: number;
  sampleExplanation: string;
};

export type FillInBlanksBlank = {
  id: number;
  answer: string;
  alternatives?: string[];
  hint?: string;
};

export type FillInBlanksConfig = {
  prompt?: string;
  template: string;
  blanks: FillInBlanksBlank[];
};

export type DragAndDropCategory = {
  id: string;
  label: string;
  color?: string;
};

export type DragAndDropItem = {
  text: string;
  correctCategory: string;
};

export type DragAndDropPair = [string, string];

export type DragAndDropConfig = {
  prompt?: string;
  mode: "classify" | "match";
  categories?: DragAndDropCategory[];
  items?: DragAndDropItem[];
  leftColumn?: Array<{ id: string; text: string }>;
  rightColumn?: Array<{ id: string; text: string }>;
  correctPairs?: DragAndDropPair[];
};

export type CompareCandidateAnswer = {
  id: string;
  label: string;
  answer?: string;
  work?: string;
  reasoning?: string;
};

export type CompareSubQuestion =
  | { type: "select_better"; prompt: string; options: string[]; answer: number }
  | {
      type: "explain";
      prompt: string;
      expectedKeywords: string[];
      minKeywords: number;
      minLength: number;
    };

export type CompareConfig = {
  prompt?: string;
  passage?: string;
  question: string;
  answers: CompareCandidateAnswer[];
  questions: CompareSubQuestion[];
};

export type MissionStep = {
  stepOrder: number;
  title: string;
  stepType: MissionStepType;
  question?: string;
  explanation?: string;
  inputPlaceholder?: string;
  answerType?: "number" | "text" | "equation" | "writing";
  correctAnswer?: string;
  acceptedAnswers?: string[];
  acceptedUnits?: string[];
  choices?: string[];
  correctChoiceIndexes?: number[];
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
  expectedSentenceCount?: number;
  writingGuide?: string[];
  sampleAnswer?: string;
  keyExpressions?: string[];
  commonMistakes?: string[];
  selfExplain?: SelfExplainConfig;
  fillInBlanks?: FillInBlanksConfig;
  dragAndDrop?: DragAndDropConfig;
  compare?: CompareConfig;
};

export type MissionPayload = {
  missionKey: string;
  title: string;
  scenario: string;
  essentialQuestion: string;
  conceptSummary: string;
  learningGoal?: string;
  conceptTags?: string[];
  mainConcept?: string;
  supportConcepts?: string[];
  difficulty: "easy" | "normal" | "hard" | "challenge";
  estimatedMinutes: number;
  steps: MissionStep[];
};

export type CurriculumUnit = {
  id: string;
  school_level: "elementary" | "middle" | "high";
  grade: number;
  unit_key: string;
  unit_name: string;
  description: string | null;
  concept_summary: string | null;
  display_order: number;
  is_active: boolean;
};

export type GeneratedMission = {
  id: string;
  subject: string;
  unit_id: string;
  title: string;
  interest_tags: string[] | null;
  difficulty: "easy" | "normal" | "hard" | "challenge";
  estimated_minutes: number;
  source_type: "manual" | "ai";
  status: "draft" | "review" | "published" | "archived";
  mission_json: MissionPayload;
  quality_notes: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MissionAttempt = {
  id: string;
  student_id: string;
  mission_id: string;
  subject?: string | null;
  unit_id?: string | null;
  status: "started" | "completed" | "abandoned";
  total_steps?: number | null;
  correct_steps?: number | null;
  score?: number | null;
  duration_sec?: number | null;
  xp_earned?: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MissionStepAttempt = {
  id: string;
  attempt_id: string;
  step_order: number;
  student_answer: string | null;
  is_correct: boolean | null;
  hint_used: boolean;
  student_id?: string | null;
  answered_at?: string | null;
  created_at: string;
};

export type StudentMissionStats = {
  totalCompletedMissions: number;
  todayCompletedCount: number;
  weeklyCompletedCount: number;
  lastCompletedAt: string | null;
  completedDates: string[];
};

export type StudentXpSummary = {
  totalXp: number;
  level: number;
  currentLevelXpFloor: number;
  nextLevelXpTarget: number;
  xpToNextLevel: number;
};

export type TodayRecommendedMission = {
  id: string;
  title: string;
  estimated_minutes: number;
  difficulty: "easy" | "normal" | "hard" | "challenge";
};

export type MissionSeed = {
  id: string;
  seed_key: string;
  unit_key: string;
  template_key: string;
  source_type: "manual" | "ai";
  status: "draft" | "review" | "published" | "archived";
  title: string;
  scenario: string;
  difficulty: "easy" | "normal" | "hard" | "challenge";
  estimated_minutes: number;
  interest_tags: string[];
  mission_json: {
    mission_title: string;
    concept_summary: string;
    steps: Array<{
      id?: string;
      step_type: MissionStepType;
      step_title: string;
      description: string;
      question?: string;
      placeholder?: string;
      choices?: string[];
      options?: string[];
      correct_answer?: string;
      answers?: number[];
      accepted_answers?: string[];
      accepted_units?: string[];
      hint?: string;
      hint_level1?: string;
      hint_level2?: string;
      hint_level3?: string;
      hints?: MissionHint[];
      solution?: MissionSolution;
    }>;
  };
  quality_notes?: string;
};
