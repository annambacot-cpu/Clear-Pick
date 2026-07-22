import type { Game, League, PredictionMarket, Team } from "./models.ts";

export const mockLeagues: League[] = [
  { id: "nfl", sport: "american-football", name: "National Football League", shortName: "NFL", country: "US" },
  { id: "nba", sport: "basketball", name: "National Basketball Association", shortName: "NBA", country: "US" },
  { id: "mlb", sport: "baseball", name: "Major League Baseball", shortName: "MLB", country: "US" },
  { id: "nhl", sport: "hockey", name: "National Hockey League", shortName: "NHL", country: "US/CA" },
  { id: "ncaaf", sport: "american-football", name: "College Football", shortName: "NCAAF", country: "US" },
  { id: "ncaab", sport: "basketball", name: "College Basketball", shortName: "NCAAB", country: "US" },
  { id: "soccer_epl", sport: "soccer", name: "English Premier League", shortName: "EPL", country: "GB" },
];

function team(id: string, leagueId: Team["leagueId"], name: string, abbreviation: string, city: string): Team {
  return { id, leagueId, name, shortName: name, abbreviation, city };
}

const buffalo = team("mock-buf", "nfl", "Bills", "BUF", "Buffalo");
const miami = team("mock-mia", "nfl", "Dolphins", "MIA", "Miami");
const yankees = team("mock-nyy", "mlb", "Yankees", "NYY", "New York");
const redSox = team("mock-bos", "mlb", "Red Sox", "BOS", "Boston");
const dodgers = team("mock-lad", "mlb", "Dodgers", "LAD", "Los Angeles");
const giants = team("mock-sf", "mlb", "Giants", "SF", "San Francisco");
const cubs = team("mock-chc", "mlb", "Cubs", "CHC", "Chicago");
const cardinals = team("mock-stl", "mlb", "Cardinals", "STL", "St. Louis");
const knicks = team("mock-nyk", "nba", "Knicks", "NYK", "New York");
const celtics = team("mock-bos-nba", "nba", "Celtics", "BOS", "Boston");
const rangers = team("mock-nyr", "nhl", "Rangers", "NYR", "New York");
const bruins = team("mock-bos-nhl", "nhl", "Bruins", "BOS", "Boston");
const michigan = team("mock-mich", "ncaaf", "Wolverines", "MICH", "Michigan");
const ohioState = team("mock-osu", "ncaaf", "Buckeyes", "OSU", "Ohio State");
const duke = team("mock-duke", "ncaab", "Blue Devils", "DUKE", "Duke");
const unc = team("mock-unc", "ncaab", "Tar Heels", "UNC", "North Carolina");
const arsenal = team("mock-ars", "soccer_epl", "Arsenal", "ARS", "London");
const liverpool = team("mock-liv", "soccer_epl", "Liverpool", "LIV", "Liverpool");

export const mockGames: Game[] = [
  {
    id: "mock-nfl-buf-mia",
    leagueId: "nfl",
    startTime: "2026-09-13T17:00:00.000Z",
    status: "scheduled",
    homeTeam: buffalo,
    awayTeam: miami,
    venue: "Orchard Park",
    providerRef: { provider: "clearpick-mock", externalId: "mock-nfl-buf-mia" },
  },
  {
    id: "mock-mlb-nyy-bos",
    leagueId: "mlb",
    startTime: "2026-07-22T23:10:00.000Z",
    status: "live",
    statusDetail: "Top 7th · Sample",
    homeTeam: redSox,
    awayTeam: yankees,
    venue: "Boston",
    homeScore: { teamId: redSox.id, total: 3 },
    awayScore: { teamId: yankees.id, total: 4 },
    providerRef: { provider: "clearpick-mock", externalId: "mock-mlb-nyy-bos" },
  },
  {
    id: "mock-mlb-lad-sf",
    leagueId: "mlb",
    startTime: "2026-07-23T01:45:00.000Z",
    status: "scheduled",
    homeTeam: giants,
    awayTeam: dodgers,
    venue: "San Francisco",
    providerRef: { provider: "clearpick-mock", externalId: "mock-mlb-lad-sf" },
  },
  {
    id: "mock-mlb-chc-stl",
    leagueId: "mlb",
    startTime: "2026-07-21T23:45:00.000Z",
    status: "final",
    statusDetail: "Final · Sample",
    homeTeam: cardinals,
    awayTeam: cubs,
    venue: "St. Louis",
    homeScore: { teamId: cardinals.id, total: 2 },
    awayScore: { teamId: cubs.id, total: 5 },
    providerRef: { provider: "clearpick-mock", externalId: "mock-mlb-chc-stl" },
  },
  ...[
    { id: "nba", leagueId: "nba" as const, homeTeam: celtics, awayTeam: knicks, startTime: "2026-10-21T23:30:00.000Z", venue: "Boston" },
    { id: "nhl", leagueId: "nhl" as const, homeTeam: bruins, awayTeam: rangers, startTime: "2026-10-08T23:00:00.000Z", venue: "Boston" },
    { id: "ncaaf", leagueId: "ncaaf" as const, homeTeam: ohioState, awayTeam: michigan, startTime: "2026-11-28T17:00:00.000Z", venue: "Columbus" },
    { id: "ncaab", leagueId: "ncaab" as const, homeTeam: unc, awayTeam: duke, startTime: "2027-02-06T23:30:00.000Z", venue: "Chapel Hill" },
    { id: "soccer", leagueId: "soccer_epl" as const, homeTeam: liverpool, awayTeam: arsenal, startTime: "2026-08-23T15:30:00.000Z", venue: "Liverpool" },
  ].map((game) => ({
    ...game,
    id: `mock-${game.id}`,
    status: "scheduled" as const,
    providerRef: { provider: "clearpick-mock", externalId: `mock-${game.id}` },
  })),
];

function referenceLines(leagueId: Team["leagueId"]) {
  if (leagueId === "mlb") return { spread: 1.5, total: 7.5 };
  if (leagueId === "nfl" || leagueId === "ncaaf") return { spread: 3.5, total: 47.5 };
  if (leagueId === "nba" || leagueId === "ncaab") return { spread: 4.5, total: 221.5 };
  if (leagueId === "nhl") return { spread: 1.5, total: 5.5 };
  return { spread: 1.5, total: 2.5 };
}

export function createMockMarkets(game: Game): PredictionMarket[] {
  const lines = referenceLines(game.leagueId);
  const updated = "2026-07-22T12:00:00.000Z";
  const providerRef = (suffix: string) => ({ provider: "clearpick-mock", externalId: `${game.id}-${suffix}` });
  const winnerSelections: PredictionMarket["selections"] = [
    { id: `${game.id}-winner-away`, label: `${game.awayTeam.city ?? ""} ${game.awayTeam.shortName}`.trim(), participantId: game.awayTeam.id, side: "away", americanOdds: 115 },
    { id: `${game.id}-winner-home`, label: `${game.homeTeam.city ?? ""} ${game.homeTeam.shortName}`.trim(), participantId: game.homeTeam.id, side: "home", americanOdds: -125 },
  ];
  if (game.leagueId === "soccer_epl") winnerSelections.push({ id: `${game.id}-winner-draw`, label: "Draw", americanOdds: 240 });

  return [
    { id: `${game.id}-winner`, gameId: game.id, leagueId: game.leagueId, type: "winner", label: "Game winner", selections: winnerSelections, lastUpdated: updated, providerRef: providerRef("winner") },
    {
      id: `${game.id}-spread`, gameId: game.id, leagueId: game.leagueId, type: "spread", label: game.leagueId === "mlb" ? "Run line" : "Point spread", lastUpdated: updated, providerRef: providerRef("spread"),
      selections: [
        { id: `${game.id}-spread-away`, label: game.awayTeam.shortName, participantId: game.awayTeam.id, side: "away", line: lines.spread, americanOdds: -110 },
        { id: `${game.id}-spread-home`, label: game.homeTeam.shortName, participantId: game.homeTeam.id, side: "home", line: -lines.spread, americanOdds: -110 },
      ],
    },
    {
      id: `${game.id}-total`, gameId: game.id, leagueId: game.leagueId, type: "total", label: "Game total", lastUpdated: updated, providerRef: providerRef("total"),
      selections: [
        { id: `${game.id}-total-over`, label: "Over", side: "over", line: lines.total, americanOdds: -105 },
        { id: `${game.id}-total-under`, label: "Under", side: "under", line: lines.total, americanOdds: -115 },
      ],
    },
  ];
}

export const mockMarkets: PredictionMarket[] = mockGames.flatMap(createMockMarkets);
