export interface DecisionScoreInput {
  confidence: number;
  evidenceCount: number;
  hasWrittenReason: boolean;
  emotionalState: string;
  decisionPace: "immediate" | "some-thought" | "reviewed-information";
  pauseReviewed: boolean;
  outcome?: "correct" | "incorrect";
}

export interface DecisionScore {
  reasoning: number;
  calibration: number;
  emotionalControl: number;
  processDiscipline: number;
  outcome: number | null;
  total: number;
}

export function calculateDecisionScore(input: DecisionScoreInput): DecisionScore {
  const reasoning = Math.min(25, input.evidenceCount * 9 + (input.hasWrittenReason ? 5 : 0));
  const calibration = input.confidence <= 75 ? 22 : input.evidenceCount >= 2 ? 20 : 13;
  const emotionalControl = input.emotionalState === "Calm & analytical" ? 20 : input.pauseReviewed ? 17 : 12;
  const processDiscipline = input.decisionPace === "reviewed-information"
    ? 20
    : input.decisionPace === "some-thought"
      ? 15
      : input.pauseReviewed ? 13 : 8;
  const outcome = input.outcome === undefined ? null : input.outcome === "correct" ? 10 : 0;
  const processTotal = Math.min(90, Math.round(reasoning + calibration + emotionalControl + processDiscipline));
  return { reasoning, calibration, emotionalControl, processDiscipline, outcome, total: processTotal + (outcome ?? 0) };
}
