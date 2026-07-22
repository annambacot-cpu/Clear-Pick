import { mockGames, mockLeagues, mockMarkets } from "./mock-data.ts";
import type { DataEnvelope, GameQuery, MarketQuery, SportsDataProvider } from "./provider.ts";

function envelope<T>(data: T): DataEnvelope<T> {
  const fetchedAt = new Date().toISOString();
  return {
    data,
    mode: "mock",
    provider: "clearpick-mock",
    fetchedAt,
    staleAt: fetchedAt,
    delayed: true,
    warnings: ["Sample data — not a live sports feed."],
  };
}

export class MockSportsDataProvider implements SportsDataProvider {
  readonly name = "ClearPick mock data";
  readonly capabilities = {
    liveScores: false,
    gameClocks: false,
    teamLogos: false,
    injuries: false,
    statistics: false,
    featuredMarkets: true,
    playerProps: false,
  };

  async getLeagues() {
    return envelope(mockLeagues);
  }

  async getGames(query: GameQuery) {
    return envelope(mockGames.filter((game) => game.leagueId === query.leagueId));
  }

  async getMarkets(query: MarketQuery) {
    return envelope(
      mockMarkets.filter(
        (market) => market.leagueId === query.leagueId && (!query.gameId || market.gameId === query.gameId),
      ),
    );
  }
}
