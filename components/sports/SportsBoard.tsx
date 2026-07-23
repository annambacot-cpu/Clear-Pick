"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PredictionBuilder } from "@/components/predictions/PredictionBuilder";
import { formatGameStatus } from "@/lib/sports/formatting";
import { groupGamesByPhase } from "@/lib/sports/group-games";
import { MockSportsDataProvider } from "@/lib/sports/mock-provider";
import type { Game, LeagueKey, PredictionDraft, Team } from "@/lib/sports/models";
import {
  FAVORITE_TEAMS_KEY,
  FOLLOWED_GAMES_KEY,
  mergeUpdatedGames,
  readFavoriteTeams,
  readFollowedGames,
  toggleSavedItem,
  writeStoredList,
} from "@/lib/sports/preferences";
import type { DataEnvelope } from "@/lib/sports/provider";
import { LIVE_REFRESH_MS, shouldPollLiveGames } from "@/lib/sports/refresh";
import { gamesFeedUrl } from "@/lib/sports/snapshot";

type SportsView = "board" | "favorites" | "game" | "team";

const leagues: Array<{ id: LeagueKey; label: string; sport: string; liveReady?: boolean }> = [
  { id: "mlb", label: "MLB", sport: "Baseball", liveReady: true },
  { id: "nfl", label: "NFL", sport: "Football", liveReady: true },
  { id: "nba", label: "NBA", sport: "Basketball", liveReady: true },
  { id: "nhl", label: "NHL", sport: "Hockey", liveReady: true },
  { id: "ncaaf", label: "College FB", sport: "Football", liveReady: true },
  { id: "ncaab", label: "College BB", sport: "Basketball", liveReady: true },
  { id: "soccer_epl", label: "Soccer", sport: "EPL", liveReady: true },
];

const groupLabels = {
  live: { title: "Live", note: "Scores refresh automatically when a live feed is connected." },
  upcoming: { title: "Upcoming", note: "Scheduled games in chronological order." },
  completed: { title: "Completed", note: "Recent official results when available." },
} as const;

function apiBase() {
  return (process.env.NEXT_PUBLIC_SPORTS_API_BASE_URL ?? "").replace(/\/$/, "");
}

function formatStart(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function teamName(team: Team) {
  return [team.city, team.shortName].filter(Boolean).join(" ");
}

async function loadMockGames(leagueId: LeagueKey, warning?: string): Promise<DataEnvelope<Game[]>> {
  const result = await new MockSportsDataProvider().getGames({ leagueId, includeCompleted: true });
  return warning ? { ...result, warnings: [...result.warnings, warning] } : result;
}

function GameRow({
  game,
  dataMode,
  onOpenGame,
  onOpenTeam,
}: {
  game: Game;
  dataMode: DataEnvelope<Game[]>["mode"];
  onOpenGame(game: Game): void;
  onOpenTeam(team: Team): void;
}) {
  const showScore = game.homeScore?.total !== null && game.homeScore?.total !== undefined;
  return (
    <article className={`scoreboard-row ${game.status === "live" ? "is-live" : ""}`}>
      <div className="scoreboard-status"><strong>{formatGameStatus(game)}</strong><span>{formatStart(game.startTime)}</span></div>
      <div className="scoreboard-teams">
        <div><button className="team-link" onClick={() => onOpenTeam(game.awayTeam)}><span className="mini-team-badge warm">{game.awayTeam.abbreviation}</span><b>{teamName(game.awayTeam)}</b></button><strong>{showScore ? game.awayScore?.total : "—"}</strong></div>
        <div><button className="team-link" onClick={() => onOpenTeam(game.homeTeam)}><span className="mini-team-badge cool">{game.homeTeam.abbreviation}</span><b>{teamName(game.homeTeam)}</b></button><strong>{showScore ? game.homeScore?.total : "—"}</strong></div>
      </div>
      <div className="scoreboard-context"><span>{game.venue ?? "Venue unavailable"}</span><small>{dataMode === "live" ? "Provider score" : "Sample matchup"}</small><button onClick={() => onOpenGame(game)}>Game details →</button></div>
    </article>
  );
}

function DetailScore({ game }: { game: Game }) {
  return (
    <div className="detail-score">
      {[game.awayTeam, game.homeTeam].map((team, index) => {
        const score = index === 0 ? game.awayScore?.total : game.homeScore?.total;
        return <div key={team.id}><span className={`team-badge ${index === 0 ? "warm" : "cool"}`}>{team.abbreviation}</span><strong>{teamName(team)}</strong><b>{score ?? "—"}</b></div>;
      })}
    </div>
  );
}

export function SportsBoard({
  initialView = "board",
  onStartPrediction,
}: {
  initialView?: "board" | "favorites";
  onStartPrediction(draft: PredictionDraft): void;
}) {
  const [leagueId, setLeagueId] = useState<LeagueKey>("mlb");
  const [result, setResult] = useState<DataEnvelope<Game[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<SportsView>(initialView);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [favoriteTeams, setFavoriteTeams] = useState<Team[]>([]);
  const [followedGames, setFollowedGames] = useState<Game[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const restore = window.setTimeout(() => {
      setFavoriteTeams(readFavoriteTeams(window.localStorage));
      setFollowedGames(readFollowedGames(window.localStorage));
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  const applyResult = useCallback((nextResult: DataEnvelope<Game[]>) => {
    setResult(nextResult);
    setFollowedGames((current) => {
      const updated = mergeUpdatedGames(current, nextResult.data);
      writeStoredList(window.localStorage, FOLLOWED_GAMES_KEY, updated);
      return updated;
    });
  }, []);

  const loadGames = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await fetch(gamesFeedUrl(leagueId, apiBase()), { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Sports feed returned ${response.status}`);
      applyResult(await response.json() as DataEnvelope<Game[]>);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Sports feed unavailable";
      applyResult(await loadMockGames(leagueId, "The live feed could not be reached, so ClearPick switched to sample data."));
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applyResult, leagueId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadGames(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadGames]);

  useEffect(() => {
    if (!result || result.delayed || !shouldPollLiveGames(result.mode, result.data)) return;
    const refresh = window.setInterval(() => void loadGames(true), LIVE_REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [loadGames, result]);

  const visibleGames = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return result?.data ?? [];
    return (result?.data ?? []).filter((game) => `${teamName(game.awayTeam)} ${teamName(game.homeTeam)}`.toLowerCase().includes(needle));
  }, [query, result]);
  const groups = useMemo(() => groupGamesByPhase(visibleGames), [visibleGames]);
  const activeLeague = leagues.find((league) => league.id === leagueId) ?? leagues[0];
  const isFavorite = (team: Team) => favoriteTeams.some((saved) => saved.id === team.id);
  const isFollowed = (game: Game) => followedGames.some((saved) => saved.id === game.id);

  function chooseLeague(nextLeague: LeagueKey) {
    setLeagueId(nextLeague);
    setView("board");
    setQuery("");
  }

  function openGame(game: Game) {
    setSelectedGame(game);
    setView("game");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTeam(team: Team) {
    setSelectedTeam(team);
    setView("team");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleFavorite(team: Team) {
    setFavoriteTeams((current) => {
      const updated = toggleSavedItem(current, team);
      writeStoredList(window.localStorage, FAVORITE_TEAMS_KEY, updated);
      return updated;
    });
  }

  function toggleFollow(game: Game) {
    setFollowedGames((current) => {
      const updated = toggleSavedItem(current, game);
      writeStoredList(window.localStorage, FOLLOWED_GAMES_KEY, updated);
      return updated;
    });
  }

  const teamGames = selectedTeam
    ? [...(result?.data ?? []), ...followedGames].filter((game, index, all) =>
        (game.homeTeam.id === selectedTeam.id || game.awayTeam.id === selectedTeam.id) && all.findIndex((candidate) => candidate.id === game.id) === index)
    : [];

  return (
    <section className="sports-board" aria-labelledby="sports-board-title">
      <div className="sports-rail-wrap"><nav className="sports-rail" aria-label="Sports and leagues">
        <button className={view === "favorites" ? "active my-teams-tab" : "my-teams-tab"} onClick={() => setView("favorites")}><span>Saved</span>My Teams<i>{favoriteTeams.length + followedGames.length}</i></button>
        {leagues.map((league) => <button key={league.id} className={view !== "favorites" && league.id === leagueId ? "active" : ""} aria-pressed={league.id === leagueId} onClick={() => chooseLeague(league.id)}><span>{league.sport}</span>{league.label}{league.liveReady && <i>Live-ready</i>}</button>)}
      </nav></div>

      {view === "favorites" && (
        <div className="saved-hub">
          <button className="back" onClick={() => setView("board")}>← Back to game center</button>
          <div className="detail-heading"><div><p className="eyebrow">Device-local preferences</p><h2 id="sports-board-title">My Teams</h2></div><p>Favorites and followed games stay on this device. You control what is saved.</p></div>
          <section><div className="status-heading"><div><span className="status-dot upcoming" /><h3>Favorite teams</h3><b>{favoriteTeams.length}</b></div></div>
            {favoriteTeams.length ? <div className="saved-team-grid">{favoriteTeams.map((team) => <article key={team.id}><span className="team-badge cool">{team.abbreviation}</span><div><small>{team.leagueId.toUpperCase()}</small><strong>{teamName(team)}</strong></div><button onClick={() => openTeam(team)}>View team →</button></article>)}</div> : <div className="empty-status">Favorite a team from any game to keep it here.</div>}
          </section>
          <section><div className="status-heading"><div><span className="status-dot live" /><h3>Followed games</h3><b>{followedGames.length}</b></div><p>Scores update when that league’s feed refreshes.</p></div>
            {followedGames.length ? <div className="followed-list">{followedGames.map((game) => <GameRow key={game.id} game={game} dataMode={game.providerRef.provider === "clearpick-mock" ? "mock" : "live"} onOpenGame={openGame} onOpenTeam={openTeam} />)}</div> : <div className="empty-status">Follow a game to monitor its status without pressure or alerts.</div>}
          </section>
        </div>
      )}

      {view === "game" && selectedGame && (
        <div className="detail-page">
          <button className="back" onClick={() => setView("board")}>← Back to {activeLeague.label} games</button>
          <div className="detail-heading"><div><p className="eyebrow">{formatGameStatus(selectedGame)} · {formatStart(selectedGame.startTime)}</p><h2 id="sports-board-title">Game details</h2></div><button className={isFollowed(selectedGame) ? "save-button saved" : "save-button"} onClick={() => toggleFollow(selectedGame)}>{isFollowed(selectedGame) ? "✓ Following game" : "+ Follow game"}</button></div>
          <DetailScore game={selectedGame} />
          <div className="detail-grid">
            <article><p className="eyebrow">Game information</p><dl><div><dt>League</dt><dd>{selectedGame.leagueId.toUpperCase()}</dd></div><div><dt>Venue</dt><dd>{selectedGame.venue ?? "Unavailable"}</dd></div><div><dt>Data status</dt><dd>{selectedGame.providerRef.provider === "clearpick-mock" ? "Sample data" : "Provider data"}</dd></div></dl></article>
            <article><p className="eyebrow">Explore teams</p>{[selectedGame.awayTeam, selectedGame.homeTeam].map((team) => <button className="team-detail-link" key={team.id} onClick={() => openTeam(team)}><span className="mini-team-badge cool">{team.abbreviation}</span><strong>{teamName(team)}</strong><span>Team page →</span></button>)}</article>
            <article className="availability-card"><p className="eyebrow">Available context</p><h3>Scores, schedule, and status</h3><p>Injuries, verified records, and deeper statistics will appear only when the selected provider licenses and supplies them.</p></article>
          </div>
          <PredictionBuilder game={selectedGame} onContinue={onStartPrediction} />
        </div>
      )}

      {view === "team" && selectedTeam && (
        <div className="detail-page team-page">
          <button className="back" onClick={() => setView(selectedGame ? "game" : "board")}>← Back</button>
          <div className="team-hero"><span className="team-badge cool">{selectedTeam.abbreviation}</span><div><p className="eyebrow">{selectedTeam.leagueId.toUpperCase()} team</p><h2 id="sports-board-title">{teamName(selectedTeam)}</h2><p>{selectedTeam.record ? `Record ${selectedTeam.record}` : "Verified team record is not available from the current feed."}</p></div><button className={isFavorite(selectedTeam) ? "save-button saved" : "save-button"} onClick={() => toggleFavorite(selectedTeam)}>{isFavorite(selectedTeam) ? "★ Favorite team" : "☆ Add to My Teams"}</button></div>
          <section><div className="status-heading"><div><span className="status-dot upcoming" /><h3>Games on this board</h3><b>{teamGames.length}</b></div></div>{teamGames.length ? <div className="scoreboard-list">{teamGames.map((game) => <GameRow key={game.id} game={game} dataMode={game.providerRef.provider === "clearpick-mock" ? "mock" : "live"} onOpenGame={openGame} onOpenTeam={openTeam} />)}</div> : <div className="empty-status">No games for this team are currently loaded.</div>}</section>
          <div className="data-notice"><strong>Data restraint</strong><span>ClearPick does not invent injuries, form, or statistics when the provider does not supply them.</span></div>
        </div>
      )}

      {view === "board" && <>
        <div className="board-heading"><div><p className="eyebrow">Today’s sports desk</p><h2 id="sports-board-title">{activeLeague.label} game center</h2></div><div className="board-controls"><label><span>Find a team</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this board" /></label><div className="feed-readout" aria-live="polite"><span className={result?.mode === "live" ? "feed-live" : "feed-sample"} /><div><strong>{result?.mode === "live" ? result.delayed ? "Provider snapshot" : "Live provider data" : "Sample data mode"}</strong><small>{result ? `Updated ${new Date(result.fetchedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Connecting…"}</small></div><button onClick={() => void loadGames()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div></div></div>

        {loading && !result && <div className="board-state" role="status"><strong>Loading the game board…</strong><span>Checking schedules and recent scores.</span></div>}
        {!loading && result && result.data.length === 0 && <div className="board-state"><strong>No games available</strong><span>This league may be out of season or temporarily unavailable.</span></div>}
        {result && result.warnings.length > 0 && <div className="data-notice" role="note"><strong>{result.mode === "mock" ? "Sample board" : "Data note"}</strong><span>{result.warnings[0]}</span>{error && <small>Automatic fallback active.</small>}</div>}
        {result && result.data.length > 0 && <div className="status-groups">{(Object.keys(groupLabels) as Array<keyof typeof groupLabels>).map((key) => <section className="status-group" key={key} aria-labelledby={`status-${key}`}><div className="status-heading"><div><span className={`status-dot ${key}`} /><h3 id={`status-${key}`}>{groupLabels[key].title}</h3><b>{groups[key].length}</b></div><p>{groupLabels[key].note}</p></div>{groups[key].length ? <div className="scoreboard-list">{groups[key].map((game) => <GameRow key={game.id} game={game} dataMode={result.mode} onOpenGame={openGame} onOpenTeam={openTeam} />)}</div> : <div className="empty-status">{query ? "No teams match this search." : `No ${groupLabels[key].title.toLowerCase()} games on this board.`}</div>}</section>)}</div>}
      </>}
    </section>
  );
}
