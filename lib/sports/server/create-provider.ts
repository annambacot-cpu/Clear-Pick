import { MockSportsDataProvider } from "../mock-provider.ts";
import { FallbackSportsDataProvider, SportsDataError, type SportsDataProvider } from "../provider.ts";
import { TheOddsApiProvider } from "../providers/the-odds-api/provider.ts";

export interface SportsEnvironment {
  SPORTS_DATA_PROVIDER?: string;
  THE_ODDS_API_KEY?: string;
  SPORTS_SCHEDULE_CACHE_SECONDS?: string;
  SPORTS_MARKETS_CACHE_SECONDS?: string;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createSportsDataProvider(environment: SportsEnvironment): SportsDataProvider {
  const mock = new MockSportsDataProvider();
  const provider = environment.SPORTS_DATA_PROVIDER?.trim().toLowerCase() || "mock";
  if (provider === "mock") return mock;
  if (provider !== "the-odds-api") {
    throw new SportsDataError(`Unsupported SPORTS_DATA_PROVIDER: ${provider}`, "configuration", false);
  }

  const live = new TheOddsApiProvider({
    apiKey: environment.THE_ODDS_API_KEY ?? "",
    scheduleCacheSeconds: positiveInteger(environment.SPORTS_SCHEDULE_CACHE_SECONDS, 600),
    marketCacheSeconds: positiveInteger(environment.SPORTS_MARKETS_CACHE_SECONDS, 60),
  });
  return new FallbackSportsDataProvider(live, mock);
}
