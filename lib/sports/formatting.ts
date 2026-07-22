import type { Game } from "./models.ts";

export function formatAmericanOdds(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "Line unavailable";
  if (value === 0) return "EVEN";
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

export function formatGameStatus(game: Pick<Game, "status" | "statusDetail">): string {
  if (game.statusDetail?.trim()) return game.statusDetail.trim();
  const labels: Record<Game["status"], string> = {
    scheduled: "Scheduled",
    pregame: "Pregame",
    live: "Live",
    halftime: "Halftime",
    delayed: "Delayed",
    postponed: "Postponed",
    cancelled: "Cancelled",
    final: "Final",
  };
  return labels[game.status];
}
