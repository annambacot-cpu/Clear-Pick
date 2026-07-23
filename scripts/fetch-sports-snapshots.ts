import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LeagueKey, PredictionMarket } from "../lib/sports/models.ts";
import type { DataEnvelope } from "../lib/sports/provider.ts";
import { TheOddsApiProvider } from "../lib/sports/providers/the-odds-api/provider.ts";

const supported: Array<{ leagueId: LeagueKey; sportKey: string }> = [
  { leagueId: "nfl", sportKey: "americanfootball_nfl" },
  { leagueId: "nba", sportKey: "basketball_nba" },
  { leagueId: "mlb", sportKey: "baseball_mlb" },
  { leagueId: "nhl", sportKey: "icehockey_nhl" },
  { leagueId: "ncaaf", sportKey: "americanfootball_ncaaf" },
  { leagueId: "ncaab", sportKey: "basketball_ncaab" },
  { leagueId: "soccer_epl", sportKey: "soccer_epl" },
];

const apiKey = process.env.THE_ODDS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("THE_ODDS_API_KEY is missing. Add it as a GitHub Actions repository secret.");
}

const outputRoot = join(process.cwd(), "public", "data", "sports");
const generatedAt = new Date().toISOString();
const staleAt = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();

function snapshotEnvelope<T>(data: T, warnings: string[] = []): DataEnvelope<T> {
  return {
    data,
    mode: "live",
    provider: "the-odds-api-github-snapshot",
    fetchedAt: generatedAt,
    staleAt,
    delayed: true,
    warnings: [
      "Real provider snapshot — refreshed daily and on manual workflow runs, not in real time.",
      ...warnings,
    ],
  };
}

function oneMarketPerType(markets: PredictionMarket[]) {
  const seen = new Set<string>();
  return markets.filter((market) => {
    const key = `${market.gameId}:${market.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const activeResponse = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(apiKey)}`, {
  headers: { accept: "application/json" },
});
if (!activeResponse.ok) {
  throw new Error(`The Odds API sports directory returned ${activeResponse.status}.`);
}
const activeSports = new Set(
  ((await activeResponse.json()) as Array<{ key?: string; active?: boolean }>)
    .filter((sport) => sport.active && sport.key)
    .map((sport) => sport.key as string),
);

const provider = new TheOddsApiProvider({ apiKey });
const status: Array<{ leagueId: LeagueKey; active: boolean; games: number; markets: number }> = [];

for (const league of supported) {
  const directory = join(outputRoot, league.leagueId);
  await mkdir(directory, { recursive: true });

  if (!activeSports.has(league.sportKey)) {
    await writeJson(join(directory, "games.json"), snapshotEnvelope([], ["The provider currently marks this league as out of season."]));
    await writeJson(join(directory, "markets.json"), snapshotEnvelope([], ["No active provider markets are available for this league."]));
    status.push({ leagueId: league.leagueId, active: false, games: 0, markets: 0 });
    continue;
  }

  const games = await provider.getGames({ leagueId: league.leagueId, includeCompleted: true });
  const markets = await provider.getMarkets({
    leagueId: league.leagueId,
    marketTypes: ["winner", "spread", "total"],
  });
  const selectedMarkets = oneMarketPerType(markets.data);

  await writeJson(join(directory, "games.json"), snapshotEnvelope(games.data, games.warnings));
  await writeJson(join(directory, "markets.json"), snapshotEnvelope(selectedMarkets, markets.warnings));
  status.push({
    leagueId: league.leagueId,
    active: true,
    games: games.data.length,
    markets: selectedMarkets.length,
  });
}

await mkdir(outputRoot, { recursive: true });
await writeJson(join(outputRoot, "status.json"), {
  provider: "the-odds-api",
  generatedAt,
  schedule: "daily-or-manual",
  leagues: status,
});

console.log(`Prepared real sports snapshots for ${status.filter((item) => item.active).length} active leagues.`);
