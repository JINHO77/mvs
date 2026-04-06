import type { MissionPayload, MissionStep } from "@/types/missions";

type RandomSource = () => number;

function cloneChoices(choices: string[] | undefined): string[] | undefined {
  return Array.isArray(choices) ? [...choices] : undefined;
}

export function shuffleChoiceStep(step: MissionStep, random: RandomSource = Math.random): MissionStep {
  if (step.stepType !== "choice" || !step.choices || step.choices.length < 2) {
    return {
      ...step,
      choices: cloneChoices(step.choices),
    };
  }

  const choices = [...step.choices];

  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
  }

  return {
    ...step,
    choices,
  };
}

export function normalizeMissionChoiceOrder(
  mission: MissionPayload,
  random: RandomSource = Math.random
): MissionPayload {
  return {
    ...mission,
    steps: mission.steps.map((step) => shuffleChoiceStep(step, random)),
  };
}
