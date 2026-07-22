"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatGameStatus } from "@/lib/sports/formatting";
import { loadPredictionHistory, type PredictionHistoryEnvelope } from "@/lib/predictions/client-store";
import { classifyDecision, summarizeHistory, type StoredPrediction } from "@/lib/predictions/history";

const classificationCopy = {
  "good-unfavorable": "Good decision · unfavorable result",
  "poor-favorable": "Weak process · favorable result",
  "well-reasoned-accurate": "Well-reasoned and accurate",
  "emotional-inaccurate": "Process needs review",
  pending: "Awaiting result",
} as const;

export function DecisionHistory({ onReplay }: { onReplay(prediction: StoredPrediction): void }) {
  const [history, setHistory] = useState<PredictionHistoryEnvelope | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setHistory(await loadPredictionHistory(window.localStorage));
    setLoading(false);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  const summary = useMemo(() => summarizeHistory(history?.data ?? []), [history]);

  if (loading && !history) return <section className="insights-page"><div className="board-state" role="status"><strong>Loading your decision history…</strong><span>Checking results and calibration.</span></div></section>;

  return (
    <section className="insights-page">
      <div className="section-heading insight-heading"><div><p className="eyebrow">Your decision profile</p><h1>Patterns, not verdicts.</h1></div><div className="history-source"><strong>{history?.mode === "database" ? "Database history" : "Device-only history"}</strong><span>{history?.warning ?? "Anonymous prediction records are synced."}</span><button onClick={() => void load()} disabled={loading}>{loading ? "Checking…" : "Check results"}</button></div></div>

      <div className="metric-grid">
        <article><span>Accuracy</span><strong>{summary.accuracy === null ? "—" : `${summary.accuracy}%`}</strong><small>{summary.settled ? `${summary.correct} of ${summary.settled} settled` : "No settled predictions"}</small></article>
        <article><span>Average confidence</span><strong>{summary.averageConfidence === null ? "—" : `${summary.averageConfidence}%`}</strong><small>{summary.total ? `${summary.total} recorded decisions` : "Build your first prediction"}</small></article>
        <article><span>Avg. Decision Score</span><strong>{summary.averageDecisionScore ?? "—"}</strong><small>Process remains 90% of the score</small></article>
        <article><span>Replays complete</span><strong>{summary.replayCount}</strong><small>{history?.data.filter((item) => (item.status === "won" || item.status === "lost") && !item.replayCompletedAt).length ?? 0} ready to review</small></article>
      </div>

      <div className="actual-insights-grid">
        <article className="calibration-card"><div className="card-heading"><div><p className="eyebrow">Personalized signals</p><h2>What your history supports</h2></div><span className="status-tag">Sample-aware</span></div>
          {summary.insights.length ? <div className="actual-patterns">{summary.insights.map((insight) => <div key={insight.id}><span>{insight.label}</span><p>{insight.message}</p><small>{insight.sampleSize} relevant settled predictions</small></div>)}</div> : <div className="insufficient-pattern"><strong>Not enough evidence for a behavioral conclusion.</strong><p>ClearPick waits for at least three settled predictions in each comparison group. Until then, individual results stay individual.</p></div>}
        </article>
        <aside className="pattern-list"><p className="eyebrow">Responsible feedback</p><div><strong>90%</strong><p>Your process—not the outcome—drives most of the Decision Score.</p><span>Transparent weighting</span></div><div><strong>3+</strong><p>Small samples are labeled as possible patterns.</p><span>Per comparison group</span></div><div><strong>0</strong><p>No rewards for prediction volume or risk.</p><span>Restraint stays positive</span></div></aside>
      </div>

      <section className="history-section"><div className="section-heading"><div><p className="eyebrow">Prediction history</p><h2>Original decisions preserved</h2></div><p>Pending predictions settle when an eligible official final becomes available.</p></div>
        {!history?.data.length ? <div className="empty-status">No predictions have been locked on this device yet.</div> : <div className="decision-history-list">{history.data.map((prediction) => {
          const classification = classifyDecision(prediction);
          const game = prediction.finalGame ?? prediction.draft.game;
          const replayReady = prediction.status === "won" || prediction.status === "lost";
          return <article key={prediction.id}><div><span className={`prediction-status ${prediction.status}`}>{prediction.status}</span><small>{new Date(prediction.createdAt).toLocaleDateString()}</small></div><div><strong>{prediction.draft.game.awayTeam.abbreviation} at {prediction.draft.game.homeTeam.abbreviation}</strong><span>{prediction.draft.market.label} · {prediction.draft.selection.label}{prediction.draft.selection.line === undefined ? "" : ` ${prediction.draft.selection.line > 0 ? "+" : ""}${prediction.draft.selection.line}`}</span><small>{formatGameStatus(game)}</small></div><div><b>{prediction.finalScore ?? prediction.pregameScore}</b><span>Decision Score</span></div><div><strong>{classificationCopy[classification]}</strong>{replayReady ? <button onClick={() => onReplay(prediction)}>{prediction.replayCompletedAt ? "Review replay" : "Complete replay →"}</button> : <span>ClearPick will check again later.</span>}</div></article>;
        })}</div>}
      </section>
    </section>
  );
}
