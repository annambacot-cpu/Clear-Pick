import type { Game, GamePhase, LeagueKey, MarketType, PredictionMarket, Team } from "../../models.ts";
import { SportsDataError, type DataEnvelope, type GameQuery, type MarketQuery, type SportsDataProvider } from "../../provider.ts";
import { mockLeagues } from "../../mock-data.ts";
import type { OddsApiEvent, OddsApiGame, OddsApiMarket } from "./api-types.ts";

const sportKeys: Record<LeagueKey, string> = {
  nfl: "americanfootball_nfl",
  nba: "basketball_nba",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  ncaaf: "americanfootball_ncaaf",
  ncaab: "basketball_ncaab",
  soccer_epl: "soccer_epl",
};

const marketKeys = { winner: "h2h", spread: "spreads", total: "totals" } as const;

export interface TheOddsApiOptions {
  apiKey: string;
  fetcher?: typeof fetch;
  baseUrl?: string;
  scheduleCacheSeconds?: number;
  marketCacheSeconds?: number;
}

function teamId(leagueId: LeagueKey, name: string) {
  return `${leagueId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function normalizeTeam(leagueId: LeagueKey, name: string): Team {
  const words = name.split(/\s+/);
  const abbreviation = words.length > 1
    ? words.map((word) => word[0]).join("").slice(0, 3).toUpperCase()
    : name.slice(0, 3).toUpperCase();
  return { id: teamId(leagueId, name), leagueId, name, shortName: words.at(-1) ?? name, abbreviation };
}

function scoreFor(game: OddsApiGame, teamName: string): number | null {
  const raw = game.scores?.find((score) => score.name === teamName)?.score;
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function phaseFor(game: OddsApiGame): GamePhase {
  if (game.completed) return "final";
  return new Date(game.commence_time).getTime() <= Date.now() ? "live" : "scheduled";
}

function marketTypeFor(key: string): MarketType | null {
  if (key === "h2h") return "winner";
  if (key === "spreads") return "spread";
  if (key === "totals") return "total";
  return null;
}

export class TheOddsApiProvider implements SportsDataProvider {
  readonly name = "The Odds API";
  readonly capabilities = {
    liveScores: true,
    gameClocks: false,
    teamLogos: false,
    injuries: false,
    statistics: false,
    featuredMarkets: true,
    playerProps: true,
  };
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private readonly options: TheOddsApiOptions;

  constructor(options: TheOddsApiOptions) {
    if (!options.apiKey.trim()) {
      throw new SportsDataError("THE_ODDS_API_KEY is not configured", "configuration", false);
    }
    this.options = options;
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.the-odds-api.com/v4";
  }

  async getLeagues() {
    return this.envelope(mockLeagues, this.options.scheduleCacheSeconds ?? 600);
  }

  async getGames(query: GameQuery) {
    const path = `/sports/${sportKeys[query.leagueId]}/scores`;
    const games = await this.request<OddsApiGame[]>(path, { daysFrom: query.includeCompleted ? "3" : "1" });
    const normalized: Game[] = games.map((game) => {
      const homeTeam = normalizeTeam(query.leagueId, game.home_team);
      const awayTeam = normalizeTeam(query.leagueId, game.away_team);
      return {
        id: game.id,
        leagueId: query.leagueId,
        startTime: game.commence_time,
        status: phaseFor(game),
        statusDetail: game.completed ? "Final" : undefined,
        homeTeam,
        awayTeam,
        homeScore: { teamId: homeTeam.id, total: scoreFor(game, game.home_team) },
        awayScore: { teamId: awayTeam.id, total: scoreFor(game, game.away_team) },
        providerRef: { provider: "the-odds-api", externalId: game.id },
      };
    });
    return this.envelope(normalized, this.options.scheduleCacheSeconds ?? 600);
  }

  async getMarkets(query: MarketQuery) {
    const requested: Array<keyof typeof marketKeys> = query.marketTypes?.length
      ? query.marketTypes
      : ["winner", "spread", "total"];
    const events = await this.request<OddsApiEvent[]>(`/sports/${sportKeys[query.leagueId]}/odds`, {
      regions: "us",
      markets: requested.map((type) => marketKeys[type]).join(","),
      oddsFormat: "american",
      dateFormat: "iso",
    });
    const filtered = query.gameId ? events.filter((event) => event.id === query.gameId) : events;
    const markets = filtered.flatMap((event) => event.bookmakers.flatMap((bookmaker) =>
      bookmaker.markets.flatMap((market) => this.normalizeMarket(query.leagueId, event, bookmaker.title, market)),
    ));
    return this.envelope(markets, this.options.marketCacheSeconds ?? 60);
  }

  private normalizeMarket(leagueId: LeagueKey, event: OddsApiEvent, bookmaker: string, market: OddsApiMarket): PredictionMarket[] {
    const type = marketTypeFor(market.key);
    if (!type) return [];
    return [{
      id: `${event.id}-${bookmaker}-${market.key}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      gameId: event.id,
      leagueId,
      type,
      label: type === "winner" ? "Game winner" : type === "spread" ? "Point spread" : "Game total",
      selections: market.outcomes.map((outcome, index) => ({
        id: `${event.id}-${market.key}-${index}`,
        label: outcome.name,
        participantId: outcome.name === "Over" || outcome.name === "Under" ? undefined : teamId(leagueId, outcome.name),
        side: outcome.name === "Over" ? "over" : outcome.name === "Under" ? "under" : outcome.name === event.home_team ? "home" : "away",
        line: outcome.point,
        americanOdds: outcome.price,
      })),
      bookmaker,
      lastUpdated: market.last_update,
      providerRef: { provider: "the-odds-api", externalId: `${event.id}:${bookmaker}:${market.key}` },
    }];
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("apiKey", this.options.apiKey);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await this.fetcher(url, { headers: { accept: "application/json" } });
    if (response.status === 429) throw new SportsDataError("Provider rate limit reached", "rate-limit", true);
    if (!response.ok) throw new SportsDataError(`Provider returned ${response.status}`, "upstream", response.status >= 500);
    try {
      return await response.json() as T;
    } catch {
      throw new SportsDataError("Provider returned invalid JSON", "invalid-response", true);
    }
  }

  private envelope<T>(data: T, cacheSeconds: number): DataEnvelope<T> {
    const now = Date.now();
    return {
      data,
      mode: "live",
      provider: "the-odds-api",
      fetchedAt: new Date(now).toISOString(),
      staleAt: new Date(now + cacheSeconds * 1000).toISOString(),
      delayed: false,
      warnings: ["The provider does not supply a reliable live game clock."],
    };
  }
}
