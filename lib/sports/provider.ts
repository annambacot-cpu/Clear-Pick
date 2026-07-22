import type { Game, League, LeagueKey, PredictionMarket } from "./models.ts";

export type DataMode = "live" | "mock";

export interface DataEnvelope<T> {
  data: T;
  mode: DataMode;
  provider: string;
  fetchedAt: string;
  staleAt: string;
  delayed: boolean;
  warnings: string[];
}

export interface GameQuery {
  leagueId: LeagueKey;
  from?: string;
  to?: string;
  includeCompleted?: boolean;
}

export interface MarketQuery {
  leagueId: LeagueKey;
  gameId?: string;
  marketTypes?: Array<"winner" | "spread" | "total">;
}

export interface ProviderCapabilities {
  liveScores: boolean;
  gameClocks: boolean;
  teamLogos: boolean;
  injuries: boolean;
  statistics: boolean;
  featuredMarkets: boolean;
  playerProps: boolean;
}

export interface SportsDataProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  getLeagues(): Promise<DataEnvelope<League[]>>;
  getGames(query: GameQuery): Promise<DataEnvelope<Game[]>>;
  getMarkets(query: MarketQuery): Promise<DataEnvelope<PredictionMarket[]>>;
}

export class SportsDataError extends Error {
  readonly code: "configuration" | "rate-limit" | "upstream" | "invalid-response" | "unsupported";
  readonly retryable: boolean;

  constructor(
    message: string,
    code: "configuration" | "rate-limit" | "upstream" | "invalid-response" | "unsupported",
    retryable: boolean,
  ) {
    super(message);
    this.name = "SportsDataError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class FallbackSportsDataProvider implements SportsDataProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  private readonly primary: SportsDataProvider;
  private readonly fallback: SportsDataProvider;

  constructor(
    primary: SportsDataProvider,
    fallback: SportsDataProvider,
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.name = `${primary.name} with ${fallback.name} fallback`;
    this.capabilities = primary.capabilities;
  }

  getLeagues() {
    return this.withFallback("leagues", () => this.primary.getLeagues(), () => this.fallback.getLeagues());
  }

  getGames(query: GameQuery) {
    return this.withFallback("games", () => this.primary.getGames(query), () => this.fallback.getGames(query));
  }

  getMarkets(query: MarketQuery) {
    return this.withFallback("markets", () => this.primary.getMarkets(query), () => this.fallback.getMarkets(query));
  }

  private async withFallback<T>(
    resource: string,
    primaryRequest: () => Promise<DataEnvelope<T>>,
    fallbackRequest: () => Promise<DataEnvelope<T>>,
  ): Promise<DataEnvelope<T>> {
    try {
      return await primaryRequest();
    } catch (error) {
      const fallback = await fallbackRequest();
      const reason = error instanceof Error ? error.message : "Unknown provider error";
      return {
        ...fallback,
        warnings: [...fallback.warnings, `Live ${resource} unavailable: ${reason}`],
      };
    }
  }
}
