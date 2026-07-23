import type { LeagueKey } from "./models.ts";

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function gamesFeedUrl(leagueId: LeagueKey, serverBase = "") {
  const base = trimTrailingSlash(serverBase);
  return base
    ? `${base}/api/sports/games?league=${encodeURIComponent(leagueId)}`
    : `data/sports/${encodeURIComponent(leagueId)}/games.json`;
}

export function marketsFeedUrl(leagueId: LeagueKey, gameId: string, serverBase = "") {
  const base = trimTrailingSlash(serverBase);
  return base
    ? `${base}/api/sports/markets?league=${encodeURIComponent(leagueId)}&gameId=${encodeURIComponent(gameId)}`
    : `data/sports/${encodeURIComponent(leagueId)}/markets.json`;
}
