import type { Game, Team } from "./models.ts";

export const FAVORITE_TEAMS_KEY = "clearpick-favorite-teams-v1";
export const FOLLOWED_GAMES_KEY = "clearpick-followed-games-v1";

export function readStoredList<T>(storage: Pick<Storage, "getItem">, key: string): T[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export function writeStoredList<T>(storage: Pick<Storage, "setItem">, key: string, items: T[]) {
  storage.setItem(key, JSON.stringify(items));
}

export function toggleSavedItem<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((saved) => saved.id === item.id)
    ? items.filter((saved) => saved.id !== item.id)
    : [...items, item];
}

export function mergeUpdatedGames(saved: Game[], updates: Game[]): Game[] {
  const byId = new Map(updates.map((game) => [game.id, game]));
  return saved.map((game) => byId.get(game.id) ?? game);
}

export function readFavoriteTeams(storage: Pick<Storage, "getItem">) {
  return readStoredList<Team>(storage, FAVORITE_TEAMS_KEY);
}

export function readFollowedGames(storage: Pick<Storage, "getItem">) {
  return readStoredList<Game>(storage, FOLLOWED_GAMES_KEY);
}
