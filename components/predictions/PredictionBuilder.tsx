"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatAmericanOdds } from "@/lib/sports/formatting";
import { MockSportsDataProvider } from "@/lib/sports/mock-provider";
import type { Game, MarketSelection, MarketType, PredictionDraft, PredictionMarket } from "@/lib/sports/models";
import type { DataEnvelope } from "@/lib/sports/provider";
import { marketsFeedUrl } from "@/lib/sports/snapshot";

const categories: Array<{ type: MarketType; label: string; available: boolean }> = [
  { type: "winner", label: "Winner", available: true },
  { type: "spread", label: "Spread", available: true },
  { type: "total", label: "Total", available: true },
  { type: "player-prop", label: "Player", available: false },
  { type: "team-prop", label: "Team", available: false },
  { type: "future", label: "Futures", available: false },
  { type: "combination", label: "Combination", available: false },
  { type: "live", label: "In-game", available: false },
];

function apiBase() {
  return (process.env.NEXT_PUBLIC_SPORTS_API_BASE_URL ?? "").replace(/\/$/, "");
}

function lineLabel(selection: MarketSelection) {
  if (selection.line === undefined) return "Pick winner";
  const line = selection.line > 0 ? `+${selection.line}` : `${selection.line}`;
  return `${selection.label} ${line}`;
}

export function PredictionBuilder({ game, onContinue }: { game: Game; onContinue(draft: PredictionDraft): void }) {
  const [result, setResult] = useState<DataEnvelope<PredictionMarket[]> | null>(null);
  const [activeType, setActiveType] = useState<MarketType>("winner");
  const [selectedMarket, setSelectedMarket] = useState<PredictionMarket | null>(null);
  const [selectedSelection, setSelectedSelection] = useState<MarketSelection | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(marketsFeedUrl(game.leagueId, game.id, apiBase()), { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("Market feed unavailable");
      const envelope = await response.json() as DataEnvelope<PredictionMarket[]>;
      setResult({ ...envelope, data: envelope.data.filter((market) => market.gameId === game.id) });
    } catch {
      const fallback = await new MockSportsDataProvider().getMarkets({ leagueId: game.leagueId, gameId: game.id, marketTypes: ["winner", "spread", "total"] });
      setResult({ ...fallback, warnings: [...fallback.warnings, "Live market references were unavailable."] });
    } finally {
      setLoading(false);
    }
  }, [game.id, game.leagueId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMarkets(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadMarkets]);

  const activeMarkets = useMemo(() => result?.data.filter((market) => market.type === activeType) ?? [], [activeType, result]);

  function chooseCategory(type: MarketType, available: boolean) {
    if (!available) return;
    setActiveType(type);
    setSelectedMarket(null);
    setSelectedSelection(null);
  }

  function chooseSelection(market: PredictionMarket, selection: MarketSelection) {
    setSelectedMarket(market);
    setSelectedSelection(selection);
  }

  return (
    <section className="prediction-builder" aria-labelledby="prediction-builder-title">
      <div className="prediction-builder-heading"><div><p className="eyebrow">Simulated predictions</p><h3 id="prediction-builder-title">Build your read</h3></div><span>No money · No payout · One decision at a time</span></div>
      <nav className="market-tabs" aria-label="Prediction categories">{categories.map((category) => <button key={category.type} className={activeType === category.type ? "active" : ""} disabled={!category.available} onClick={() => chooseCategory(category.type, category.available)}><span>{category.label}</span>{!category.available && <small>Later</small>}</button>)}</nav>
      <div className="prediction-layout">
        <div className="market-panel">
          {loading && <div className="empty-status" role="status">Loading prediction categories…</div>}
          {!loading && activeMarkets.length === 0 && <div className="empty-status">This category is unavailable for the selected game.</div>}
          {activeMarkets.map((market) => <article className="market-card" key={market.id}><div><strong>{market.label}</strong><span>{result?.mode === "live" ? "Provider reference" : "Sample reference"}{market.bookmaker ? ` · ${market.bookmaker}` : ""}</span></div><div className="market-options">{market.selections.map((selection) => <button key={selection.id} className={selectedSelection?.id === selection.id ? "selected" : ""} aria-pressed={selectedSelection?.id === selection.id} onClick={() => chooseSelection(market, selection)}><strong>{lineLabel(selection)}</strong><span>Market ref. {formatAmericanOdds(selection.americanOdds)}</span></button>)}</div></article>)}
          <div className="market-explainer"><strong>What these mean</strong><p><b>Winner</b> predicts the game result. <b>Spread</b> applies the displayed scoring margin. <b>Total</b> predicts whether combined scoring finishes above or below the displayed line.</p></div>
        </div>
        <aside className="prediction-slip">
          <div><p className="eyebrow">Prediction slip</p><span>{selectedSelection ? "1 selection" : "Empty"}</span></div>
          {selectedMarket && selectedSelection ? <><small>{game.awayTeam.abbreviation} at {game.homeTeam.abbreviation}</small><h4>{selectedMarket.label}</h4><strong>{lineLabel(selectedSelection)}</strong><p>Reference: {formatAmericanOdds(selectedSelection.americanOdds)} · No stake or payout</p></> : <div className="slip-empty"><strong>Select one prediction</strong><p>Your choice will appear here before the decision-quality check.</p></div>}
          <button className="primary" disabled={!selectedMarket || !selectedSelection} onClick={() => selectedMarket && selectedSelection && onContinue({ game, market: selectedMarket, selection: selectedSelection })}>Continue to decision check <span>→</span></button>
          <small className="slip-note">ClearPick records your reasoning, not financial risk.</small>
        </aside>
      </div>
    </section>
  );
}
