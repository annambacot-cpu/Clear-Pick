"use client";

import { useEffect, useMemo, useState } from "react";

type Screen = "home" | "pick" | "locked" | "replay" | "insights";

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

const history = [
  { teams: "Cleveland at Baltimore", pick: "Baltimore", result: "Correct", process: 88 },
  { teams: "Seattle at Detroit", pick: "Seattle", result: "Incorrect", process: 84 },
  { teams: "New York at Green Bay", pick: "Green Bay", result: "Correct", process: 75 },
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

  useEffect(() => {
    const last = window.localStorage.getItem("clearpick-last-screen");
    if (last === "insights") setScreen("insights");
  }, []);

  const game = games[gameIndex];
  const evidenceReasons = selectedReasons.filter(
    (reason) => !["Favorite-team loyalty", "Gut feeling", "Expert or social opinion"].includes(reason),
  );
  const pauseNeeded =
    (confidence >= 80 && evidenceReasons.length < 2) ||
    speed === "Immediately" ||
    decisionState === "Frustrated by a previous loss" ||
    selectedReasons.includes("Favorite-team loyalty");

  const score = useMemo(() => {
    const reasoning = Math.min(25, evidenceReasons.length * 9 + (note.trim() ? 5 : 0));
    const calibration = confidence <= 75 ? 22 : evidenceReasons.length >= 2 ? 20 : 13;
    const emotional = decisionState === "Calm & analytical" ? 20 : pauseReviewed ? 17 : 12;
    const discipline = speed === "After reviewing information" ? 20 : speed === "After a little thought" ? 15 : pauseReviewed ? 13 : 8;
    return Math.min(90, Math.round(reasoning + calibration + emotional + discipline));
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
    go("pick");
  }

  function finishReplay() {
    setSaved(true);
    window.localStorage.setItem("clearpick-last-screen", "insights");
    window.setTimeout(() => go("insights"), 650);
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

          <section className="dashboard-section">
            <div className="section-heading">
              <div><p className="eyebrow">Today’s board</p><h2>Choose your matchup</h2></div>
              <p>Three games. No odds. No pressure.<br />Just your read of the game.</p>
            </div>
            <div className="game-grid">
              {games.map((item, index) => (
                <article className={index === 0 ? "game-card featured" : "game-card"} key={item.away}>
                  <div className="game-meta"><span>{item.day}</span><b>{item.time}</b></div>
                  <div className="matchup">
                    <div className="team-badge warm">{item.away.slice(0, 3).toUpperCase()}</div>
                    <div><strong>{item.away}</strong><span>at</span><strong>{item.home}</strong></div>
                    <div className="team-badge cool">{item.home.slice(0, 3).toUpperCase()}</div>
                  </div>
                  <p>{item.note}</p>
                  <button onClick={() => resetPick(index)}>Open matchup <span>→</span></button>
                </article>
              ))}
            </div>
          </section>

          <section className="insight-strip">
            <div className="insight-number">+11%</div>
            <div><p className="eyebrow">Your clearest signal</p><h2>You’re more accurate when you review two or more signals.</h2></div>
            <button onClick={() => go("insights")}>View the evidence →</button>
          </section>
        </>
      )}

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
                <div><h2>Who wins?</h2><p>Choose the team your evidence supports.</p></div>
                <div className="team-choice-row">
                  {[game.away, game.home].map((item, index) => (
                    <button key={item} className={team === item ? "team-choice selected" : "team-choice"} onClick={() => setTeam(item)}>
                      <span className={index === 0 ? "team-badge warm" : "team-badge cool"}>{item.slice(0, 3).toUpperCase()}</span>
                      <strong>{item}</strong><small>{team === item ? "Your pick" : "Select"}</small>
                    </button>
                  ))}
                </div>
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
              </div>

              {pauseNeeded && (
                <div className="reflection-card">
                  <span>Reflection flag</span>
                  <div><h3>Confidence may be rising faster than the evidence.</h3><p>Sharp decision-makers check what would change their mind. You stay in control.</p></div>
                  <button onClick={() => setPauseReviewed(true)} className={pauseReviewed ? "reviewed" : ""}>{pauseReviewed ? "✓ Reasoning reviewed" : "I reviewed my reasoning"}</button>
                </div>
              )}

              <button className="primary lock-button" disabled={!team || selectedReasons.length === 0} onClick={() => go("locked")}>Review and lock pick <span>→</span></button>
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
              <div className="summary-reasons">{selectedReasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
              <p>{note || "No written note added."}</p>
            </article>
            <article className="process-card">
              <p className="eyebrow">Pre-game Decision Score</p><strong>{score}</strong><span>/100</span>
              <h3>{score >= 78 ? "Strong process" : "Useful baseline"}</h3>
              <p>Your score rewards evidence, calibration, awareness, and discipline. The game result contributes only 10% later.</p>
            </article>
          </div>
          <div className="locked-actions"><button className="primary" onClick={() => go("replay")}>Simulate final result <span>→</span></button><button className="text-button" onClick={() => go("home")}>Return home</button></div>
        </section>
      )}

      {screen === "replay" && (
        <section className="replay-page">
          <div className="outcome-banner"><div><p className="eyebrow">Final · Simulation</p><h2>Miami 20 <span>·</span> Buffalo 27</h2></div><strong className={team === "Buffalo" ? "correct" : "incorrect"}>{team === "Buffalo" ? "Prediction correct" : "Prediction incorrect"}</strong></div>
          <div className="replay-layout">
            <div>
              <p className="eyebrow">Decision replay</p><h1>Judge the process, not just the scoreboard.</h1><p className="lede">Use the information that was available when you made the pick—not what became obvious afterward.</p>
              <fieldset><legend>Would you make the same choice with the information you had at the time?</legend>{["Yes — the reasoning still holds", "Maybe — I missed a useful signal", "No — emotion or impulse took over"].map((answer) => <label key={answer}><input type="radio" name="replay" checked={replayAnswer === answer} onChange={() => setReplayAnswer(answer)} /><span>{answer}</span></label>)}</fieldset>
              <button className="primary" disabled={!replayAnswer || saved} onClick={finishReplay}>{saved ? "Replay saved ✓" : "Complete replay"} <span>→</span></button>
            </div>
            <aside className="replay-feedback"><p className="eyebrow">Process feedback</p><div className="feedback-score"><strong>{Math.min(100, score + (replayAnswer ? 7 : 0))}</strong><span>Decision Score</span></div><h3>{team === "Buffalo" ? "A sound pick—and a good result." : "The result missed. The process held up."}</h3><p>You used {evidenceReasons.length || "limited"} evidence signal{evidenceReasons.length === 1 ? "" : "s"}, recorded your state, and set a measurable confidence level. Completing this replay strengthens the process regardless of the outcome.</p></aside>
          </div>
        </section>
      )}

      {screen === "insights" && (
        <section className="insights-page">
          <div className="section-heading insight-heading"><div><p className="eyebrow">Your decision profile</p><h1>Patterns, not verdicts.</h1></div><p>Based on 12 simulated decisions.<br />Early findings are labeled clearly.</p></div>
          <div className="metric-grid">
            <article><span>Accuracy</span><strong>67%</strong><small>8 of 12 correct</small></article>
            <article><span>Average confidence</span><strong>72%</strong><small>5 points above accuracy</small></article>
            <article><span>Avg. Decision Score</span><strong>81</strong><small>Strong process range</small></article>
            <article><span>Replays complete</span><strong>10</strong><small>2 ready to review</small></article>
          </div>
          <div className="insights-layout">
            <article className="calibration-card">
              <div className="card-heading"><div><p className="eyebrow">Confidence calibration</p><h2>Closer than last month</h2></div><span className="status-tag">Possible pattern</span></div>
              <div className="calibration-chart" aria-label="Confidence compared with accuracy by band">
                {[{ band: "50–59%", c: 55, a: 52 }, { band: "60–69%", c: 65, a: 63 }, { band: "70–79%", c: 74, a: 68 }, { band: "80%+", c: 86, a: 71 }].map((row) => <div className="chart-row" key={row.band}><span>{row.band}</span><div><i className="confidence-bar" style={{ width: `${row.c}%` }} /><i className="accuracy-bar" style={{ width: `${row.a}%` }} /></div><b>{row.a}% right</b></div>)}
              </div>
              <div className="chart-key"><span><i className="confidence-dot" />Confidence</span><span><i className="accuracy-dot" />Accuracy</span></div>
            </article>
            <aside className="pattern-list">
              <p className="eyebrow">Signals worth watching</p>
              <div><strong>+11%</strong><p>You’re more accurate with two or more evidence signals.</p><span>9 relevant picks</span></div>
              <div><strong>−14%</strong><p>Favorite-team picks are less accurate than your baseline.</p><span>7 relevant picks · Possible pattern</span></div>
              <div><strong>+9</strong><p>Your process score improves when you pause before locking.</p><span>8 relevant picks</span></div>
            </aside>
          </div>
          <section className="history-section"><div className="section-heading"><div><p className="eyebrow">Recent work</p><h2>Outcome and process, side by side</h2></div></div><div className="history-table"><div className="history-head"><span>Matchup</span><span>Prediction</span><span>Outcome</span><span>Decision score</span></div>{history.map((item) => <div className="history-row" key={item.teams}><strong>{item.teams}</strong><span>{item.pick}</span><span className={item.result === "Correct" ? "correct-text" : "incorrect-text"}>{item.result}</span><b>{item.process}</b></div>)}</div></section>
          <div className="badge-row"><div><p className="eyebrow">Process badges</p><h2>Skills you’ve demonstrated</h2></div><span>Evidence First<small>2+ signals on 5 picks</small></span><span>Process Over Outcome<small>Replayed after a loss</small></span><span>Bias Spotter<small>Named team loyalty</small></span></div>
        </section>
      )}

      <footer><div className="brand"><span className="brand-mark">CP</span><span>ClearPick</span></div><p>Train your sports IQ without risking money.</p><span>Prototype · Scores are illustrative, not clinically validated.</span></footer>
    </main>
  );
}
