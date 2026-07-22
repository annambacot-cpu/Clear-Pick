"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateDecisionScore } from "@/lib/decision/score";
import { SportsBoard } from "@/components/sports/SportsBoard";
import { formatAmericanOdds } from "@/lib/sports/formatting";
import type { PredictionDraft } from "@/lib/sports/models";
import { DecisionHistory } from "@/components/insights/DecisionHistory";
import { getDeviceId, savePrediction, saveReplay } from "@/lib/predictions/client-store";
import { classifyDecision, completeReplay, createPendingPrediction, settlePrediction, type StoredPrediction } from "@/lib/predictions/history";

type Screen = "home" | "favorites" | "pick" | "locked" | "replay" | "insights";

const reasons = [
  "Recent form",
  "Player availability",
  "Matchup advantage",
  "Statistical trend",
  "Home-field advantage",
  "Expert or social opinion",
  "Favorite-team loyalty",
  "Gut feeling",
];

const states = [
  "Calm & analytical",
  "Excited",
  "Frustrated by a previous loss",
  "Bored",
  "Following friends or social media",
  "Loyal to this team",
  "Not sure",
];

const games = [
  { away: "Miami", home: "Buffalo", day: "SUN", time: "1:00 PM", note: "Week 8 · Orchard Park" },
  { away: "Dallas", home: "Philadelphia", day: "SUN", time: "4:25 PM", note: "Week 8 · Philadelphia" },
  { away: "Denver", home: "Kansas City", day: "MON", time: "8:15 PM", note: "Week 8 · Kansas City" },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gameIndex, setGameIndex] = useState(0);
  const [team, setTeam] = useState("");
  const [confidence, setConfidence] = useState(64);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [decisionState, setDecisionState] = useState("Calm & analytical");
  const [speed, setSpeed] = useState("After reviewing information");
  const [note, setNote] = useState("");
  const [pauseReviewed, setPauseReviewed] = useState(false);
  const [replayAnswer, setReplayAnswer] = useState("");
  const [saved, setSaved] = useState(false);
  const [sportsDraft, setSportsDraft] = useState<PredictionDraft | null>(null);
  const [supportsTeam, setSupportsTeam] = useState(false);
  const [recentLoss, setRecentLoss] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState<StoredPrediction | null>(null);

  useEffect(() => {
    const restoreScreen = window.setTimeout(() => {
      const last = window.localStorage.getItem("clearpick-last-screen");
      if (last === "insights") setScreen("insights");
    }, 0);
    return () => window.clearTimeout(restoreScreen);
  }, []);

  const legacyGame = games[gameIndex];
  const game = sportsDraft ? {
    away: [sportsDraft.game.awayTeam.city, sportsDraft.game.awayTeam.shortName].filter(Boolean).join(" "),
    home: [sportsDraft.game.homeTeam.city, sportsDraft.game.homeTeam.shortName].filter(Boolean).join(" "),
    day: new Date(sportsDraft.game.startTime).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    time: new Date(sportsDraft.game.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    note: sportsDraft.game.venue ?? sportsDraft.game.leagueId.toUpperCase(),
  } : legacyGame;
  const evidenceReasons = selectedReasons.filter(
    (reason) => !["Favorite-team loyalty", "Gut feeling", "Expert or social opinion"].includes(reason),
  );
  const pauseNeeded =
    (confidence >= 80 && evidenceReasons.length < 2) ||
    speed === "Immediately" ||
    decisionState === "Frustrated by a previous loss" ||
    recentLoss ||
    supportsTeam ||
    selectedReasons.includes("Favorite-team loyalty");

  const score = useMemo(() => {
    return calculateDecisionScore({
      confidence,
      evidenceCount: evidenceReasons.length,
      hasWrittenReason: Boolean(note.trim()),
      emotionalState: decisionState,
      decisionPace: speed === "Immediately" ? "immediate" : speed === "After a little thought" ? "some-thought" : "reviewed-information",
      pauseReviewed,
    }).total;
  }, [confidence, decisionState, evidenceReasons.length, note, pauseReviewed, speed]);

  function toggleReason(reason: string) {
    setSelectedReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : current.length < 3
          ? [...current, reason]
          : current,
    );
  }

  function go(next: Screen) {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetPick(index = 0) {
    setSportsDraft(null);
    setGameIndex(index);
    setTeam("");
    setConfidence(64);
    setSelectedReasons([]);
    setDecisionState("Calm & analytical");
    setSpeed("After reviewing information");
    setNote("");
    setPauseReviewed(false);
    setReplayAnswer("");
    setSaved(false);
    setSupportsTeam(false);
    setRecentLoss(false);
    setCurrentPrediction(null);
    go("pick");
  }

  function startSportsPrediction(draft: PredictionDraft) {
    setSportsDraft(draft);
    setTeam(draft.selection.label);
    setConfidence(64);
    setSelectedReasons([]);
    setDecisionState("Calm & analytical");
    setSpeed("After reviewing information");
    setNote("");
    setPauseReviewed(false);
    setReplayAnswer("");
    setSaved(false);
    setSupportsTeam(false);
    setRecentLoss(false);
    setCurrentPrediction(null);
    go("pick");
  }

  function finishReplay() {
    setSaved(true);
    if (currentPrediction && replayAnswer) {
      const updated = completeReplay(currentPrediction, replayAnswer);
      setCurrentPrediction(updated);
      void saveReplay(window.localStorage, updated);
    }
    window.localStorage.setItem("clearpick-last-screen", "insights");
    window.setTimeout(() => go("insights"), 650);
  }

  function lockPick() {
    if (sportsDraft) {
      const decision = {
        confidence,
        reasons: selectedReasons,
        evidenceReviewed: evidenceReasons,
        emotionalState: decisionState,
        supportsParticipant: supportsTeam || decisionState === "Loyal to this team" || selectedReasons.includes("Favorite-team loyalty"),
        followedRecentLoss: recentLoss || decisionState === "Frustrated by a previous loss",
        decisionPace: speed === "Immediately" ? "immediate" as const : speed === "After a little thought" ? "some-thought" as const : "reviewed-information" as const,
        pausedBeforeLocking: pauseReviewed || speed !== "Immediately",
        note,
      };
      let prediction = createPendingPrediction({ deviceId: getDeviceId(window.localStorage), draft: sportsDraft, decision, pregameScore: score });
      prediction = settlePrediction(prediction, sportsDraft.game);
      setCurrentPrediction(prediction);
      void savePrediction(window.localStorage, prediction);
    }
    go("locked");
  }

  function openStoredReplay(prediction: StoredPrediction) {
    setSportsDraft(prediction.draft);
    setTeam(prediction.draft.selection.label);
    setConfidence(prediction.decision.confidence);
    setSelectedReasons(prediction.decision.reasons);
    setDecisionState(prediction.decision.emotionalState);
    setSpeed(prediction.decision.decisionPace === "immediate" ? "Immediately" : prediction.decision.decisionPace === "some-thought" ? "After a little thought" : "After reviewing information");
    setNote(prediction.decision.note ?? "");
    setPauseReviewed(prediction.decision.pausedBeforeLocking);
    setSupportsTeam(prediction.decision.supportsParticipant);
    setRecentLoss(prediction.decision.followedRecentLoss);
    setReplayAnswer(prediction.replayAnswer ?? "");
    setSaved(Boolean(prediction.replayCompletedAt));
    setCurrentPrediction(prediction);
    go("replay");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go("home")} aria-label="ClearPick home">
          <span className="brand-mark">CP</span>
          <span>ClearPick</span>
        </button>
        <nav aria-label="Primary navigation">
          <button className={screen === "home" ? "active" : ""} onClick={() => go("home")}>Today</button>
          <button className={screen === "favorites" ? "active" : ""} onClick={() => go("favorites")}>My teams</button>
          <button className={screen === "insights" ? "active" : ""} onClick={() => go("insights")}>My patterns</button>
          <button onClick={() => resetPick(0)}>New pick</button>
        </nav>
        <div className="simulation-pill"><span /> Simulation only · No money</div>
      </header>

      {screen === "home" && (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">Decision training for sports fans</p>
              <h1>Prove how good your sports decisions <em>actually</em> are.</h1>
              <p className="hero-copy">Make simulated picks. Track your evidence, confidence, and state of mind. Learn whether a win was smart—or just lucky.</p>
              <div className="hero-actions">
                <button className="primary" onClick={() => resetPick(0)}>Make a prediction <span>→</span></button>
                <button className="text-button" onClick={() => go("insights")}>See my patterns</button>
              </div>
            </div>
            <aside className="score-card feature-score">
              <div className="card-kicker"><span>Latest form</span><b>Strong</b></div>
              <div className="score-ring" style={{ "--score": "82%" } as React.CSSProperties}>
                <div><strong>82</strong><span>Decision Score</span></div>
              </div>
              <p>Outcome: incorrect</p>
              <h3>Good process. Tough result.</h3>
              <small>Your evidence was relevant and your confidence was well calibrated.</small>
            </aside>
          </section>

          <SportsBoard onStartPrediction={startSportsPrediction} />

          <section className="insight-strip">
            <div className="insight-number">+11%</div>
            <div><p className="eyebrow">Your clearest signal</p><h2>You’re more accurate when you review two or more signals.</h2></div>
            <button onClick={() => go("insights")}>View the evidence →</button>
          </section>
        </>
      )}

      {screen === "favorites" && <SportsBoard initialView="favorites" onStartPrediction={startSportsPrediction} />}

      {screen === "pick" && (
        <section className="flow-page">
          <div className="flow-progress" aria-label="Prediction progress"><span className="done">1 Matchup</span><i /><span className="current">2 Your read</span><i /><span>3 Lock</span></div>
          <div className="flow-layout">
            <div className="flow-main">
              <button className="back" onClick={() => go("home")}>← Today’s matchups</button>
              <p className="eyebrow">{game.day} · {game.time} · Simulation</p>
              <h1>{game.away} <span>at</span> {game.home}</h1>
              <p className="lede">Build the pick you would stand behind—even if the result goes the other way.</p>

              <div className="form-section">
                <div className="question-number">01</div>
                <div><h2>{sportsDraft ? "Your prediction" : "Who wins?"}</h2><p>{sportsDraft ? "Confirm the market selection you chose before recording your reasoning." : "Choose the team your evidence supports."}</p></div>
                {sportsDraft ? <div className="selected-prediction-card"><div><span>{sportsDraft.market.label}</span><strong>{sportsDraft.selection.label}{sportsDraft.selection.line === undefined ? "" : ` ${sportsDraft.selection.line > 0 ? "+" : ""}${sportsDraft.selection.line}`}</strong><small>Market reference {formatAmericanOdds(sportsDraft.selection.americanOdds)} · No stake or payout</small></div><button onClick={() => go("home")}>Change selection</button></div> : <div className="team-choice-row">
                  {[game.away, game.home].map((item, index) => <button key={item} className={team === item ? "team-choice selected" : "team-choice"} onClick={() => setTeam(item)}><span className={index === 0 ? "team-badge warm" : "team-badge cool"}>{item.slice(0, 3).toUpperCase()}</span><strong>{item}</strong><small>{team === item ? "Your pick" : "Select"}</small></button>)}
                </div>}
              </div>

              <div className="form-section">
                <div className="question-number">02</div>
                <div><h2>How confident are you?</h2><p>Out of 100 similar picks, how often would you expect to be right?</p></div>
                <div className="confidence-control">
                  <output>{confidence}<small>%</small></output>
                  <input aria-label="Confidence percentage" type="range" min="50" max="95" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} />
                  <div><span>50 · Toss-up</span><span>95 · Extremely sure</span></div>
                </div>
              </div>

              <div className="form-section">
                <div className="question-number">03</div>
                <div><h2>What supports your pick?</h2><p>Choose up to three. Evidence is more useful than volume.</p></div>
                <div className="chip-grid">
                  {reasons.map((reason) => <button aria-pressed={selectedReasons.includes(reason)} className={selectedReasons.includes(reason) ? "chip selected" : "chip"} onClick={() => toggleReason(reason)} key={reason}>{selectedReasons.includes(reason) ? "✓ " : "+ "}{reason}</button>)}
                </div>
                <label className="note-field">Strongest reason <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional — one clear sentence" /></label>
              </div>

              <div className="form-section compact-section">
                <div className="question-number">04</div>
                <div><h2>Quick state check</h2><p>What is influencing you right now?</p></div>
                <div className="select-row">
                  <label>Current state<select value={decisionState} onChange={(event) => setDecisionState(event.target.value)}>{states.map((state) => <option key={state}>{state}</option>)}</select></label>
                  <label>Decision speed<select value={speed} onChange={(event) => setSpeed(event.target.value)}><option>Immediately</option><option>After a little thought</option><option>After reviewing information</option></select></label>
                </div>
                <div className="context-checks"><button type="button" aria-pressed={supportsTeam} className={supportsTeam ? "selected" : ""} onClick={() => setSupportsTeam((value) => !value)}><span>{supportsTeam ? "✓" : "+"}</span><strong>I support one of these teams</strong><small>Helps identify favorite-team bias</small></button><button type="button" aria-pressed={recentLoss} className={recentLoss ? "selected" : ""} onClick={() => setRecentLoss((value) => !value)}><span>{recentLoss ? "✓" : "+"}</span><strong>This follows a recent loss</strong><small>Helps separate reaction from evidence</small></button></div>
              </div>

              {pauseNeeded && (
                <div className="reflection-card">
                  <span>Reflection flag</span>
                  <div><h3>Confidence may be rising faster than the evidence.</h3><p>Sharp decision-makers check what would change their mind. You stay in control.</p></div>
                  <button onClick={() => setPauseReviewed(true)} className={pauseReviewed ? "reviewed" : ""}>{pauseReviewed ? "✓ Reasoning reviewed" : "I reviewed my reasoning"}</button>
                </div>
              )}

              <button className="primary lock-button" disabled={!team || selectedReasons.length === 0} onClick={lockPick}>Review and lock pick <span>→</span></button>
            </div>
            <aside className="live-score">
              <p className="eyebrow">Live process read</p>
              <div className="mini-score"><strong>{score}</strong><span>/100</span></div>
              <h3>{score >= 78 ? "Disciplined setup" : score >= 64 ? "Developing setup" : "Needs another look"}</h3>
              <div className="score-line"><span>Reasoning</span><i><b style={{ width: `${Math.min(100, evidenceReasons.length * 36 + (note ? 18 : 0))}%` }} /></i></div>
              <div className="score-line"><span>Calibration</span><i><b style={{ width: `${confidence <= 75 ? 88 : evidenceReasons.length >= 2 ? 80 : 52}%` }} /></i></div>
              <div className="score-line"><span>Self-awareness</span><i><b style={{ width: `${decisionState === "Calm & analytical" || pauseReviewed ? 90 : 62}%` }} /></i></div>
              <small>This is a transparent prototype score, not a scientifically validated assessment.</small>
            </aside>
          </div>
        </section>
      )}

      {screen === "locked" && (
        <section className="result-page">
          <p className="eyebrow">Pick locked · Original answer preserved</p>
          <h1>Your read is on the record.</h1>
          <p>No money. No changes behind the scenes. When the game resolves, review the decision using only what you knew at the time.</p>
          <div className="locked-grid">
            <article className="ticket-card">
              <div className="ticket-top"><span>{game.day} · {game.time}</span><b>SIMULATION</b></div>
              <h2>{game.away} <span>at</span> {game.home}</h2>
              <div className="pick-summary"><span>Your pick</span><strong>{team}</strong><em>{confidence}% confident</em></div>
              {sportsDraft && <div className="market-lock-summary"><span>{sportsDraft.market.label}</span><strong>{sportsDraft.selection.line === undefined ? "Winner-style prediction" : `Line ${sportsDraft.selection.line > 0 ? "+" : ""}${sportsDraft.selection.line}`}</strong><small>Reference {formatAmericanOdds(sportsDraft.selection.americanOdds)} · no payout</small></div>}
              <div className="summary-reasons">{selectedReasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
              <p>{note || "No written note added."}</p>
            </article>
            <article className="process-card">
              <p className="eyebrow">Pre-game Decision Score</p><strong>{score}</strong><span>/100</span>
              <h3>{score >= 78 ? "Strong process" : "Useful baseline"}</h3>
              <p>Your score rewards evidence, calibration, awareness, and discipline. The game result contributes only 10% later.</p>
            </article>
          </div>
          <div className="locked-actions">{sportsDraft ? currentPrediction && (currentPrediction.status === "won" || currentPrediction.status === "lost") ? <><div className="pending-result-note"><strong>Official result available</strong><span>Replay the decision using only what you knew when it was locked.</span></div><button className="primary" onClick={() => go("replay")}>Open Decision Replay <span>→</span></button></> : <><div className="pending-result-note"><strong>Awaiting the official result</strong><span>ClearPick will settle this automatically when an eligible final is available.</span></div><button className="primary" onClick={() => go("home")}>Return to game center <span>→</span></button></> : <><button className="primary" onClick={() => go("replay")}>Simulate final result <span>→</span></button><button className="text-button" onClick={() => go("home")}>Return home</button></>}</div>
        </section>
      )}

      {screen === "replay" && (
        <section className="replay-page">
          {currentPrediction?.finalGame ? <div className="outcome-banner"><div><p className="eyebrow">Final · {currentPrediction.finalGame.providerRef.provider === "clearpick-mock" ? "Sample result" : "Provider result"}</p><h2>{currentPrediction.finalGame.awayTeam.abbreviation} {currentPrediction.finalGame.awayScore?.total} <span>·</span> {currentPrediction.finalGame.homeTeam.abbreviation} {currentPrediction.finalGame.homeScore?.total}</h2></div><strong className={currentPrediction.status === "won" ? "correct" : "incorrect"}>{currentPrediction.status === "won" ? "Prediction correct" : "Prediction incorrect"}</strong></div> : <div className="outcome-banner"><div><p className="eyebrow">Final · Simulation</p><h2>Miami 20 <span>·</span> Buffalo 27</h2></div><strong className={team === "Buffalo" ? "correct" : "incorrect"}>{team === "Buffalo" ? "Prediction correct" : "Prediction incorrect"}</strong></div>}
          <div className="replay-layout">
            <div>
              <p className="eyebrow">Decision replay</p><h1>Judge the process, not just the scoreboard.</h1><p className="lede">Use the information that was available when you made the pick—not what became obvious afterward.</p>
              <fieldset><legend>Would you make the same choice with the information you had at the time?</legend>{["Yes — the reasoning still holds", "Maybe — I missed a useful signal", "No — emotion or impulse took over"].map((answer) => <label key={answer}><input type="radio" name="replay" checked={replayAnswer === answer} onChange={() => setReplayAnswer(answer)} /><span>{answer}</span></label>)}</fieldset>
              <button className="primary" disabled={!replayAnswer || saved} onClick={finishReplay}>{saved ? "Replay saved ✓" : "Complete replay"} <span>→</span></button>
            </div>
            <aside className="replay-feedback"><p className="eyebrow">Process feedback</p><div className="feedback-score"><strong>{currentPrediction?.finalScore ?? Math.min(100, score + (replayAnswer ? 7 : 0))}</strong><span>Decision Score</span></div><h3>{currentPrediction ? classifyDecision(currentPrediction) === "well-reasoned-accurate" ? "Well-reasoned—and accurate." : classifyDecision(currentPrediction) === "good-unfavorable" ? "Good decision. Unfavorable result." : classifyDecision(currentPrediction) === "poor-favorable" ? "Favorable result. Process needs work." : "Emotion or impulse may have outweighed the evidence." : team === "Buffalo" ? "A sound pick—and a good result." : "The result missed. The process held up."}</h3><p>You used {evidenceReasons.length || "limited"} evidence signal{evidenceReasons.length === 1 ? "" : "s"}, recorded your state, and set a measurable confidence level. A correct result contributes 10%; the decision process contributes up to 90%.</p></aside>
          </div>
        </section>
      )}

      {screen === "insights" && <DecisionHistory onReplay={openStoredReplay} />}

      <footer><div className="brand"><span className="brand-mark">CP</span><span>ClearPick</span></div><p>Train your sports IQ without risking money.</p><span>Prototype · Scores are illustrative, not clinically validated.</span></footer>
    </main>
  );
}
