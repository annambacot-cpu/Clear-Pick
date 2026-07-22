import type { Game } from "./models.ts";
import type { DataMode } from "./provider.ts";

export const LIVE_REFRESH_MS = 40_000;

export function shouldPollLiveGames(mode: DataMode, games: Game[]) {
  return mode === "live" && games.some((game) => game.status === "live" || game.status === "halftime");
}
