import type { DecisionContext, Game, PredictionDraft, PredictionResult } from "../sports/models.ts";
import { settleSpread, settleTotal, settleWinner } from "../sports/settlement.ts";

export type ReplayClassification =
  | "good-unfavorable"
  | "poor-favorable"
  | "well-reasoned-accurate"
  | "emotional-inaccurate"
  | "pending";

export interface StoredPrediction {
  id: string;
  deviceId: string;
  draft: PredictionDraft;
  decision: DecisionContext;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "won" | "lost" | "push" | "void";
  pregameScore: number;
  finalScore: number | null;
  result: PredictionResult | null;
  finalGame: Game | null;
  replayAnswer: string | null;
  replayCompletedAt: string | null;
}

export interface BehavioralInsight {
  id: string;
  label: "Possible pattern" | "Pattern";
  message: string;
  sampleSize: number;
}

export interface HistorySummary {
  total: number;
  settled: number;
  correct: number;
  accuracy: number | null;
  averageConfidence: number | null;
  averageDecisionScore: number | null;
  replayCount: number;
  insights: BehavioralInsight[];
}

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `prediction-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createPendingPrediction(args: {
  deviceId: string;
  draft: PredictionDraft;
  decision: DecisionContext;
  pregameScore: number;
  now?: string;
}): StoredPrediction {
  const now = args.now ?? new Date().toISOString();
  return {
    id: randomId(),
    deviceId: args.deviceId,
    draft: args.draft,
    decision: args.decision,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    pregameScore: args.pregameScore,
    finalScore: null,
    result: null,
    finalGame: null,
    replayAnswer: null,
    replayCompletedAt: null,
  };
}

function settlementFor(prediction: StoredPrediction, game: Game) {
  if (game.status !== "final") return null;
  const home = game.homeScore?.total;
  const away = game.awayScore?.total;
  if (home === null || home === undefined || away === null || away === undefined) return null;
  const selection = prediction.draft.selection;
  if (prediction.draft.market.type === "winner" && (selection.side === "home" || selection.side === "away")) return settleWinner(selection.side, { home, away });
  if (prediction.draft.market.type === "spread" && (selection.side === "home" || selection.side === "away") && selection.line !== undefined) return settleSpread(selection.side, selection.line, { home, away });
  if (prediction.draft.market.type === "total" && (selection.side === "over" || selection.side === "under") && selection.line !== undefined) return settleTotal(selection.side, selection.line, { home, away });
  return "void" as const;
}

export function settlePrediction(prediction: StoredPrediction, game: Game, now = new Date().toISOString()): StoredPrediction {
  if (prediction.status !== "pending" || prediction.draft.game.id !== game.id) return prediction;
  const status = settlementFor(prediction, game);
  if (!status) return prediction;
  const outcome = status === "won" ? "correct" : status === "lost" ? "incorrect" : undefined;
  const finalScore = outcome === "correct" ? Math.min(100, prediction.pregameScore + 10) : prediction.pregameScore;
  const explanation = status === "won"
    ? "The official result matched this simulated prediction."
    : status === "lost"
      ? "The official result did not match this simulated prediction."
      : status === "push"
        ? "The official result matched the line exactly, so the prediction was a push."
        : "This prediction could not be settled from the available result.";
  return {
    ...prediction,
    status,
    finalScore,
    finalGame: game,
    updatedAt: now,
    result: { predictionId: prediction.id, status, resolvedAt: now, explanation },
  };
}

export function completeReplay(prediction: StoredPrediction, answer: string, now = new Date().toISOString()): StoredPrediction {
  return { ...prediction, replayAnswer: answer, replayCompletedAt: now, updatedAt: now };
}

export function classifyDecision(prediction: StoredPrediction): ReplayClassification {
  if (prediction.status !== "won" && prediction.status !== "lost") return "pending";
  const strongProcess = prediction.pregameScore >= 70;
  if (strongProcess && prediction.status === "won") return "well-reasoned-accurate";
  if (strongProcess && prediction.status === "lost") return "good-unfavorable";
  if (!strongProcess && prediction.status === "won") return "poor-favorable";
  return "emotional-inaccurate";
}

function accuracy(items: StoredPrediction[]) {
  const settled = items.filter((item) => item.status === "won" || item.status === "lost");
  if (!settled.length) return null;
  return settled.filter((item) => item.status === "won").length / settled.length;
}

function patternLabel(sampleSize: number): BehavioralInsight["label"] {
  return sampleSize >= 8 ? "Pattern" : "Possible pattern";
}

export function summarizeHistory(predictions: StoredPrediction[]): HistorySummary {
  const settled = predictions.filter((item) => item.status === "won" || item.status === "lost");
  const confidence = predictions.length ? Math.round(predictions.reduce((sum, item) => sum + item.decision.confidence, 0) / predictions.length) : null;
  const averageScore = predictions.length ? Math.round(predictions.reduce((sum, item) => sum + (item.finalScore ?? item.pregameScore), 0) / predictions.length) : null;
  const insights: BehavioralInsight[] = [];

  const favoritePicks = settled.filter((item) => item.decision.supportsParticipant);
  const neutralPicks = settled.filter((item) => !item.decision.supportsParticipant);
  if (favoritePicks.length >= 3 && neutralPicks.length >= 3) {
    const favoriteAccuracy = accuracy(favoritePicks)!;
    const neutralAccuracy = accuracy(neutralPicks)!;
    const delta = Math.round(Math.abs(favoriteAccuracy - neutralAccuracy) * 100);
    insights.push({ id: "favorite-bias", label: patternLabel(favoritePicks.length + neutralPicks.length), sampleSize: favoritePicks.length + neutralPicks.length, message: favoriteAccuracy < neutralAccuracy ? `Your favorite-team predictions are ${delta} points less accurate.` : `Your favorite-team predictions are ${delta} points more accurate so far.` });
  }

  const evidencePicks = settled.filter((item) => item.decision.evidenceReviewed.length >= 2);
  const lowEvidencePicks = settled.filter((item) => item.decision.evidenceReviewed.length < 2);
  if (evidencePicks.length >= 3 && lowEvidencePicks.length >= 3) {
    const delta = Math.round(Math.abs(accuracy(evidencePicks)! - accuracy(lowEvidencePicks)!) * 100);
    insights.push({ id: "evidence", label: patternLabel(evidencePicks.length + lowEvidencePicks.length), sampleSize: evidencePicks.length + lowEvidencePicks.length, message: accuracy(evidencePicks)! >= accuracy(lowEvidencePicks)! ? `You are ${delta} points more accurate after reviewing multiple signals.` : `Multiple signals have not improved accuracy yet; keep watching this pattern.` });
  }

  const quickPicks = settled.filter((item) => item.decision.decisionPace === "immediate");
  const pausedPicks = settled.filter((item) => item.decision.decisionPace !== "immediate");
  if (quickPicks.length >= 3 && pausedPicks.length >= 3) {
    const delta = Math.round(Math.abs(accuracy(quickPicks)! - accuracy(pausedPicks)!) * 100);
    insights.push({ id: "pace", label: patternLabel(quickPicks.length + pausedPicks.length), sampleSize: quickPicks.length + pausedPicks.length, message: accuracy(pausedPicks)! >= accuracy(quickPicks)! ? `Waiting before locking improves accuracy by ${delta} points.` : `Quick decisions are ${delta} points more accurate so far; treat this as an early signal.` });
  }

  return {
    total: predictions.length,
    settled: settled.length,
    correct: settled.filter((item) => item.status === "won").length,
    accuracy: settled.length ? Math.round((settled.filter((item) => item.status === "won").length / settled.length) * 100) : null,
    averageConfidence: confidence,
    averageDecisionScore: averageScore,
    replayCount: predictions.filter((item) => item.replayCompletedAt).length,
    insights,
  };
}
