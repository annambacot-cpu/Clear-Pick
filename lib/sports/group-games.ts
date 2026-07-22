import type { Game } from "./models.ts";

export interface GameGroups {
  live: Game[];
  upcoming: Game[];
  completed: Game[];
}

export function groupGamesByPhase(games: Game[]): GameGroups {
  const groups: GameGroups = { live: [], upcoming: [], completed: [] };
  const sorted = [...games].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  sorted.forEach((game) => {
    if (["live", "halftime", "delayed"].includes(game.status)) groups.live.push(game);
    else if (["final", "cancelled"].includes(game.status)) groups.completed.push(game);
    else groups.upcoming.push(game);
  });

  groups.completed.reverse();
  return groups;
}
