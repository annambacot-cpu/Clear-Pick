import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calculateDecisionScore } from "../lib/decision/score.ts";
import { formatAmericanOdds, formatGameStatus } from "../lib/sports/formatting.ts";
import { groupGamesByPhase } from "../lib/sports/group-games.ts";
import { MockSportsDataProvider } from "../lib/sports/mock-provider.ts";
import { FallbackSportsDataProvider, type SportsDataProvider } from "../lib/sports/provider.ts";
import { TheOddsApiProvider } from "../lib/sports/providers/the-odds-api/provider.ts";
import { mergeUpdatedGames, readStoredList, toggleSavedItem } from "../lib/sports/preferences.ts";
import { classifyDecision, createPendingPrediction, settlePrediction, summarizeHistory } from "../lib/predictions/history.ts";
import { settleSpread, settleTotal, settleWinner } from "../lib/sports/settlement.ts";
import { LIVE_REFRESH_MS, shouldPollLiveGames } from "../lib/sports/refresh.ts";
import type { LeagueKey } from "../lib/sports/models.ts";
import { gamesFeedUrl, marketsFeedUrl } from "../lib/sports/snapshot.ts";

test("formats American market lines without implying a payout", () => {
  assert.equal(formatAmericanOdds(120), "+120");
  assert.equal(formatAmericanOdds(-105), "-105");
  assert.equal(formatAmericanOdds(0), "EVEN");
  assert.equal(formatAmericanOdds(undefined), "Line unavailable");
});

test("uses provider detail when available and otherwise labels game phase", () => {
  assert.equal(formatGameStatus({ status: "live", statusDetail: "Top 7th" }), "Top 7th");
  assert.equal(formatGameStatus({ status: "halftime" }), "Halftime");
  assert.equal(formatGameStatus({ status: "final" }), "Final");
});

test("groups game-center rows into live, upcoming, and completed sections", async () => {
  const games = (await new MockSportsDataProvider().getGames({ leagueId: "mlb" })).data;
  const groups = groupGamesByPhase(games);
  assert.equal(groups.live.length, 1);
  assert.equal(groups.upcoming.length, 1);
  assert.equal(groups.completed.length, 1);
  assert.equal(groups.live[0]?.status, "live");
  assert.equal(groups.completed[0]?.status, "final");
});

test("keeps every requested league navigable in fallback mode", async () => {
  const provider = new MockSportsDataProvider();
  const leagues: LeagueKey[] = ["nfl", "nba", "mlb", "nhl", "ncaaf", "ncaab", "soccer_epl"];
  for (const leagueId of leagues) {
    const games = await provider.getGames({ leagueId });
    assert.ok(games.data.length >= 1, `${leagueId} should have a fallback game`);
    assert.equal(games.data[0]?.leagueId, leagueId);
  }
});

test("maps all requested leagues to live-provider score endpoints", async () => {
  const requested: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    requested.push(String(input));
    return new Response("[]", { headers: { "content-type": "application/json" } });
  };
  const provider = new TheOddsApiProvider({ apiKey: "test-key", fetcher });
  const leagues: LeagueKey[] = ["nfl", "nba", "mlb", "nhl", "ncaaf", "ncaab", "soccer_epl"];
  for (const leagueId of leagues) await provider.getGames({ leagueId });
  for (const key of ["americanfootball_nfl", "basketball_nba", "baseball_mlb", "icehockey_nhl", "americanfootball_ncaaf", "basketball_ncaab", "soccer_epl"]) {
    assert.ok(requested.some((url) => url.includes(`/sports/${key}/scores`)), `${key} endpoint should be mapped`);
  }
});

test("polls only genuine live-provider games at a restrained interval", async () => {
  const games = (await new MockSportsDataProvider().getGames({ leagueId: "mlb" })).data;
  assert.equal(LIVE_REFRESH_MS, 40_000);
  assert.equal(shouldPollLiveGames("mock", games), false);
  assert.equal(shouldPollLiveGames("live", games), true);
  assert.equal(shouldPollLiveGames("live", games.filter((game) => game.status !== "live")), false);
});

test("uses static GitHub snapshots when no protected server is configured", () => {
  assert.equal(gamesFeedUrl("mlb"), "data/sports/mlb/games.json");
  assert.equal(marketsFeedUrl("nba", "game 1"), "data/sports/nba/markets.json");
  assert.equal(
    gamesFeedUrl("nfl", "https://api.example.com/"),
    "https://api.example.com/api/sports/games?league=nfl",
  );
  assert.equal(
    marketsFeedUrl("soccer_epl", "event/1", "https://api.example.com"),
    "https://api.example.com/api/sports/markets?league=soccer_epl&gameId=event%2F1",
  );
});

test("normalizes the MLB scores feed without exposing provider response shapes", async () => {
  const fetcher: typeof fetch = async (input) => {
    assert.match(String(input), /\/sports\/baseball_mlb\/scores/);
    return new Response(JSON.stringify([{
      id: "provider-game-1",
      sport_key: "baseball_mlb",
      sport_title: "MLB",
      commence_time: "2026-07-21T23:10:00.000Z",
      completed: true,
      home_team: "Boston Red Sox",
      away_team: "New York Yankees",
      scores: [{ name: "Boston Red Sox", score: "3" }, { name: "New York Yankees", score: "5" }],
      last_update: "2026-07-22T02:15:00.000Z",
    }]), { headers: { "content-type": "application/json" } });
  };
  const provider = new TheOddsApiProvider({ apiKey: "test-key", fetcher });
  const result = await provider.getGames({ leagueId: "mlb", includeCompleted: true });
  assert.equal(result.mode, "live");
  assert.equal(result.data[0]?.status, "final");
  assert.equal(result.data[0]?.homeScore?.total, 3);
  assert.equal(result.data[0]?.awayTeam.shortName, "Yankees");
});

test("offers winner, spread, and total categories in mock fallback mode", async () => {
  const provider = new MockSportsDataProvider();
  const games = await provider.getGames({ leagueId: "mlb" });
  const markets = await provider.getMarkets({ leagueId: "mlb", gameId: games.data[0]!.id });
  assert.deepEqual(markets.data.map((market) => market.type), ["winner", "spread", "total"]);
  assert.equal(markets.data[1]?.selections[0]?.line, 1.5);
  assert.equal(markets.data[2]?.selections[0]?.side, "over");
});

test("settles winner, spread, and total predictions", () => {
  const score = { home: 27, away: 20 };
  assert.equal(settleWinner("home", score), "won");
  assert.equal(settleWinner("away", score), "lost");
  assert.equal(settleSpread("away", 7, score), "push");
  assert.equal(settleSpread("away", 7.5, score), "won");
  assert.equal(settleTotal("over", 46.5, score), "won");
  assert.equal(settleTotal("under", 47, score), "push");
});

test("keeps process quality dominant in the Decision Score", () => {
  const strongProcess = calculateDecisionScore({
    confidence: 72,
    evidenceCount: 3,
    hasWrittenReason: true,
    emotionalState: "Calm & analytical",
    decisionPace: "reviewed-information",
    pauseReviewed: false,
    outcome: "incorrect",
  });
  assert.equal(strongProcess.total, 87);
  assert.equal(strongProcess.outcome, 0);

  const correctOutcome = calculateDecisionScore({
    confidence: 72,
    evidenceCount: 3,
    hasWrittenReason: true,
    emotionalState: "Calm & analytical",
    decisionPace: "reviewed-information",
    pauseReviewed: false,
    outcome: "correct",
  });
  assert.equal(correctOutcome.total, 97);
});

test("falls back to clearly labeled mock data when the live provider fails", async () => {
  const failingProvider: SportsDataProvider = {
    name: "failing-live-provider",
    capabilities: {
      liveScores: true,
      gameClocks: false,
      teamLogos: false,
      injuries: false,
      statistics: false,
      featuredMarkets: true,
      playerProps: false,
    },
    async getLeagues() { throw new Error("offline"); },
    async getGames() { throw new Error("offline"); },
    async getMarkets() { throw new Error("offline"); },
  };
  const provider = new FallbackSportsDataProvider(failingProvider, new MockSportsDataProvider());
  const result = await provider.getGames({ leagueId: "mlb" });
  assert.equal(result.mode, "mock");
  assert.equal(result.delayed, true);
  assert.match(result.warnings.join(" "), /Live games unavailable: offline/);
  assert.equal(result.data[0]?.leagueId, "mlb");
});

test("stores favorites predictably and refreshes followed game snapshots", async () => {
  const games = (await new MockSportsDataProvider().getGames({ leagueId: "mlb" })).data;
  const team = games[0]!.homeTeam;
  assert.deepEqual(toggleSavedItem([], team), [team]);
  assert.deepEqual(toggleSavedItem([team], team), []);
  assert.deepEqual(readStoredList({ getItem: () => "not-json" }, "favorites"), []);

  const saved = [{ ...games[0]!, homeScore: { teamId: team.id, total: 1 } }];
  const updated = mergeUpdatedGames(saved, games);
  assert.equal(updated[0]?.homeScore?.total, 3);
});

test("settles a stored prediction and distinguishes process quality from outcome", async () => {
  const provider = new MockSportsDataProvider();
  const games = await provider.getGames({ leagueId: "mlb" });
  const finalGame = games.data.find((game) => game.status === "final")!;
  const markets = await provider.getMarkets({ leagueId: "mlb", gameId: finalGame.id });
  const winner = markets.data.find((market) => market.type === "winner")!;
  const decision = {
    confidence: 72,
    reasons: ["Recent form", "Statistical trend"],
    evidenceReviewed: ["Recent form", "Statistical trend"],
    emotionalState: "Calm & analytical",
    supportsParticipant: false,
    followedRecentLoss: false,
    decisionPace: "reviewed-information" as const,
    pausedBeforeLocking: true,
    note: "Two relevant signals",
  };
  const winning = createPendingPrediction({ deviceId: "test-device", draft: { game: finalGame, market: winner, selection: winner.selections[0]! }, decision, pregameScore: 87, now: "2026-07-21T20:00:00.000Z" });
  const settledWin = settlePrediction(winning, finalGame, "2026-07-22T02:00:00.000Z");
  assert.equal(settledWin.status, "won");
  assert.equal(settledWin.finalScore, 97);
  assert.equal(classifyDecision(settledWin), "well-reasoned-accurate");

  const losing = { ...winning, id: "losing", draft: { game: finalGame, market: winner, selection: winner.selections[1]! }, pregameScore: 82 };
  assert.equal(classifyDecision(settlePrediction(losing, finalGame)), "good-unfavorable");
  const weakWin = { ...winning, id: "weak-win", pregameScore: 55 };
  assert.equal(classifyDecision(settlePrediction(weakWin, finalGame)), "poor-favorable");
  const weakLoss = { ...losing, id: "weak-loss", pregameScore: 55 };
  assert.equal(classifyDecision(settlePrediction(weakLoss, finalGame)), "emotional-inaccurate");
});

test("withholds behavioral conclusions until both comparison groups are large enough", async () => {
  const provider = new MockSportsDataProvider();
  const finalGame = (await provider.getGames({ leagueId: "mlb" })).data.find((game) => game.status === "final")!;
  const winner = (await provider.getMarkets({ leagueId: "mlb", gameId: finalGame.id })).data.find((market) => market.type === "winner")!;
  const make = (id: string, favorite: boolean, wins: boolean) => settlePrediction(createPendingPrediction({
    deviceId: "test-device",
    draft: { game: finalGame, market: winner, selection: winner.selections[wins ? 0 : 1]! },
    decision: { confidence: 65, reasons: ["Recent form"], evidenceReviewed: ["Recent form"], emotionalState: "Calm & analytical", supportsParticipant: favorite, followedRecentLoss: false, decisionPace: "reviewed-information", pausedBeforeLocking: true },
    pregameScore: 70,
    now: `2026-07-2${id}T12:00:00.000Z`,
  }), finalGame);
  const tooSmall = [make("1", true, false), make("2", true, false), make("3", false, true), make("4", false, true)];
  assert.equal(summarizeHistory(tooSmall).insights.length, 0);
  const enough = [...tooSmall, make("5", true, false), make("6", false, true)];
  const summary = summarizeHistory(enough);
  assert.equal(summary.insights[0]?.id, "favorite-bias");
  assert.equal(summary.insights[0]?.label, "Possible pattern");
  assert.equal(summary.insights[0]?.sampleSize, 6);
});

test("keeps manipulative engagement mechanics out of product source", async () => {
  const files = [
    "../app/page.tsx",
    "../components/sports/SportsBoard.tsx",
    "../components/predictions/PredictionBuilder.tsx",
    "../components/insights/DecisionHistory.tsx",
  ];
  const source = (await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /new\s+Audio|Notification\.requestPermission|IntersectionObserver/);
  assert.doesNotMatch(source, /deposit|withdrawal|jackpot|odds boost|limited time|chase (a )?loss/i);
});
