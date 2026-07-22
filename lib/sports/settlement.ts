export type SettlementStatus = "won" | "lost" | "push" | "void";

export interface FinalScore {
  home: number;
  away: number;
}

export function settleWinner(side: "home" | "away", score: FinalScore): SettlementStatus {
  if (score.home === score.away) return "push";
  const winner = score.home > score.away ? "home" : "away";
  return winner === side ? "won" : "lost";
}

export function settleSpread(side: "home" | "away", line: number, score: FinalScore): SettlementStatus {
  const selected = side === "home" ? score.home : score.away;
  const opponent = side === "home" ? score.away : score.home;
  const adjusted = selected + line;
  if (adjusted === opponent) return "push";
  return adjusted > opponent ? "won" : "lost";
}

export function settleTotal(side: "over" | "under", line: number, score: FinalScore): SettlementStatus {
  const total = score.home + score.away;
  if (total === line) return "push";
  return side === "over" ? (total > line ? "won" : "lost") : (total < line ? "won" : "lost");
}
