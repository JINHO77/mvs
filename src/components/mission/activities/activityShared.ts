import type { MissionStep } from "@/types/missions";

export type ActivityResult = {
  correct: boolean;
  score: number;
  studentAnswer: string;
};

export type ActivityRendererProps = {
  step: MissionStep;
  subject: "math" | "english";
  disabled?: boolean;
  onComplete: (result: ActivityResult) => void;
};

export function isNewActivityType(step: MissionStep | null | undefined): boolean {
  if (!step) return false;
  return (
    step.stepType === "self_explain" ||
    step.stepType === "fill_in_blanks" ||
    step.stepType === "drag_and_drop" ||
    step.stepType === "compare"
  );
}

export function countMatchedKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => kw.trim().length > 0 && lower.includes(kw.toLowerCase()));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
