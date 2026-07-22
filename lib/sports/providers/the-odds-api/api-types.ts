export interface OddsApiScore {
  name: string;
  score: string;
}

export interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: OddsApiScore[] | null;
  last_update: string | null;
}

export interface OddsApiOutcome {
  name: string;
  description?: string;
  price: number;
  point?: number;
}

export interface OddsApiMarket {
  key: "h2h" | "spreads" | "totals" | string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent extends Omit<OddsApiGame, "completed" | "scores" | "last_update"> {
  bookmakers: OddsApiBookmaker[];
}
