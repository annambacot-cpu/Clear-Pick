export type SportKey =
  | "american-football"
  | "basketball"
  | "baseball"
  | "hockey"
  | "soccer";

export type LeagueKey =
  | "nfl"
  | "nba"
  | "mlb"
  | "nhl"
  | "ncaaf"
  | "ncaab"
  | "soccer_epl";

export type GamePhase =
  | "scheduled"
  | "pregame"
  | "live"
  | "halftime"
  | "delayed"
  | "postponed"
  | "cancelled"
  | "final";

export type MarketType =
  | "winner"
  | "spread"
  | "total"
  | "player-prop"
  | "team-prop"
  | "future"
  | "combination"
  | "live";

export interface ProviderReference {
  provider: string;
  externalId: string;
}

export interface League {
  id: LeagueKey;
  sport: SportKey;
  name: string;
  shortName: string;
  country: string;
  providerRef?: ProviderReference;
}

export interface Team {
  id: string;
  leagueId: LeagueKey;
  name: string;
  shortName: string;
  abbreviation: string;
  city?: string;
  record?: string;
  logoUrl?: string;
  providerRef?: ProviderReference;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  position?: string;
  jerseyNumber?: string;
  providerRef?: ProviderReference;
}

export interface TeamScore {
  teamId: string;
  total: number | null;
  periods?: number[];
}

export interface Game {
  id: string;
  leagueId: LeagueKey;
  startTime: string;
  status: GamePhase;
  statusDetail?: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: TeamScore;
  awayScore?: TeamScore;
  venue?: string;
  broadcast?: string[];
  providerRef: ProviderReference;
}

export interface MarketSelection {
  id: string;
  label: string;
  participantId?: string;
  side?: "home" | "away" | "over" | "under";
  line?: number;
  americanOdds?: number;
}

export interface PredictionMarket {
  id: string;
  gameId?: string;
  leagueId: LeagueKey;
  type: MarketType;
  label: string;
  selections: MarketSelection[];
  bookmaker?: string;
  lastUpdated: string;
  providerRef: ProviderReference;
}

export interface DecisionContext {
  confidence: number;
  reasons: string[];
  evidenceReviewed: string[];
  emotionalState: string;
  supportsParticipant: boolean;
  followedRecentLoss: boolean;
  decisionPace: "immediate" | "some-thought" | "reviewed-information";
  pausedBeforeLocking: boolean;
  note?: string;
}

export interface Prediction {
  id: string;
  marketId: string;
  selection: MarketSelection;
  lockedAt: string;
  marketSnapshot: PredictionMarket;
  decision: DecisionContext;
  status: "pending" | "won" | "lost" | "push" | "void";
}

export interface PredictionResult {
  predictionId: string;
  status: "won" | "lost" | "push" | "void";
  resolvedAt: string;
  explanation: string;
}

export interface PredictionDraft {
  game: Game;
  market: PredictionMarket;
  selection: MarketSelection;
}
