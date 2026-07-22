/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import type { LeagueKey } from "../lib/sports/models";
import { createSportsDataProvider } from "../lib/sports/server/create-provider";
import { completeReplay, settlePrediction, type StoredPrediction } from "../lib/predictions/history";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  SPORTS_DATA_PROVIDER?: string;
  THE_ODDS_API_KEY?: string;
  SPORTS_SCHEDULE_CACHE_SECONDS?: string;
  SPORTS_MARKETS_CACHE_SECONDS?: string;
  PUBLIC_APP_ORIGINS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const supportedLeagues = new Set<LeagueKey>(["nfl", "nba", "mlb", "nhl", "ncaaf", "ncaab", "soccer_epl"]);

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function defaultCache(): Cache | null {
  if (typeof caches === "undefined" || !("default" in caches)) return null;
  return (caches as CacheStorage & { default: Cache }).default;
}

function withCors(response: Response, request: Request, env: Env) {
  const origin = request.headers.get("origin");
  if (!origin) return response;
  const allowed = new Set([
    "https://annambacot-cpu.github.io",
    ...(env?.PUBLIC_APP_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  ]);
  if (!allowed.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.append("vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function sportsGames(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { allow: "GET" });
  const url = new URL(request.url);
  const requestedLeague = url.searchParams.get("league") as LeagueKey | null;
  if (!requestedLeague || !supportedLeagues.has(requestedLeague)) return json({ error: "Unsupported league" }, 400);

  try {
    const provider = createSportsDataProvider(env ?? {});
    const result = await provider.getGames({ leagueId: requestedLeague, includeCompleted: true });
    const hasLiveGame = result.data.some((game) => ["live", "halftime"].includes(game.status));
    const cacheSeconds = result.mode === "live" ? (hasLiveGame ? 40 : 600) : 0;
    const response = json(result, 200, {
      "cache-control": cacheSeconds ? `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=30` : "no-store",
      "x-clearpick-data-mode": result.mode,
    });

    const cache = defaultCache();
    if (cache && result.mode === "live" && cacheSeconds > 0) {
      ctx.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sports feed unavailable";
    return json({ error: message }, 503, { "cache-control": "no-store" });
  }
}

async function sportsMarkets(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { allow: "GET" });
  const url = new URL(request.url);
  const requestedLeague = url.searchParams.get("league") as LeagueKey | null;
  const gameId = url.searchParams.get("gameId") ?? undefined;
  if (!requestedLeague || !supportedLeagues.has(requestedLeague) || !gameId) return json({ error: "League and gameId are required" }, 400);

  try {
    const provider = createSportsDataProvider(env ?? {});
    const result = await provider.getMarkets({ leagueId: requestedLeague, gameId, marketTypes: ["winner", "spread", "total"] });
    const cacheSeconds = result.mode === "live" ? 60 : 0;
    const response = json(result, 200, {
      "cache-control": cacheSeconds ? `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=30` : "no-store",
      "x-clearpick-data-mode": result.mode,
    });
    const cache = defaultCache();
    if (cache && result.mode === "live") ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market feed unavailable";
    return json({ error: message }, 503, { "cache-control": "no-store" });
  }
}

async function ensurePredictionStorage(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS prediction_records (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      status TEXT NOT NULL,
      league_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS prediction_records_device_created_idx ON prediction_records (device_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS prediction_records_status_idx ON prediction_records (status)"),
  ]);
}

function validRecord(value: unknown): value is StoredPrediction {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredPrediction>;
  return typeof record.id === "string" && typeof record.deviceId === "string" && typeof record.createdAt === "string" && Boolean(record.draft?.game?.id);
}

async function settleDatabasePredictions(items: StoredPrediction[], env: Env) {
  const pending = items.filter((item) => item.status === "pending");
  const leagueIds = [...new Set(pending.map((item) => item.draft.game.leagueId))];
  const gamesById = new Map<string, StoredPrediction["draft"]["game"]>();

  await Promise.all(leagueIds.map(async (leagueId) => {
    try {
      const provider = createSportsDataProvider(env ?? {});
      const games = await provider.getGames({ leagueId, includeCompleted: true });
      games.data.forEach((game) => gamesById.set(game.id, game));
    } catch {
      // Pending records stay pending when the official feed is unavailable.
    }
  }));

  return items.map((item) => {
    const game = gamesById.get(item.draft.game.id);
    return game ? settlePrediction(item, game) : item;
  });
}

async function predictionsCollection(request: Request, env: Env) {
  if (!env?.DB) return json({ error: "Prediction database unavailable" }, 503, { "cache-control": "no-store" });
  await ensurePredictionStorage(env.DB);

  if (request.method === "POST") {
    const prediction = await request.json().catch(() => null);
    if (!validRecord(prediction)) return json({ error: "Invalid prediction record" }, 400);
    await env.DB.prepare(`INSERT INTO prediction_records (id, device_id, status, league_id, game_id, created_at, updated_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, payload = excluded.payload`)
      .bind(prediction.id, prediction.deviceId, prediction.status, prediction.draft.game.leagueId, prediction.draft.game.id, prediction.createdAt, prediction.updatedAt, JSON.stringify(prediction)).run();
    return json({ data: prediction, mode: "database" }, 201, { "cache-control": "no-store" });
  }

  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { allow: "GET, POST" });
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  if (!deviceId || deviceId.length > 100) return json({ error: "deviceId is required" }, 400);
  const rows = await env.DB.prepare("SELECT payload FROM prediction_records WHERE device_id = ? ORDER BY created_at DESC LIMIT 250").bind(deviceId).all<{ payload: string }>();
  const parsed = rows.results.flatMap((row) => {
    try {
      const value = JSON.parse(row.payload);
      return validRecord(value) ? [value] : [];
    } catch {
      return [];
    }
  });
  const settled = await settleDatabasePredictions(parsed, env);
  const changed = settled.filter((item, index) => item.updatedAt !== parsed[index]?.updatedAt);
  if (changed.length) {
    await env.DB.batch(changed.map((item) => env.DB!.prepare("UPDATE prediction_records SET status = ?, updated_at = ?, payload = ? WHERE id = ? AND device_id = ?").bind(item.status, item.updatedAt, JSON.stringify(item), item.id, item.deviceId)));
  }
  return json({ data: settled, mode: "database" }, 200, { "cache-control": "no-store" });
}

async function predictionReplay(request: Request, env: Env, predictionId: string) {
  if (request.method !== "PATCH") return json({ error: "Method not allowed" }, 405, { allow: "PATCH" });
  if (!env?.DB) return json({ error: "Prediction database unavailable" }, 503, { "cache-control": "no-store" });
  await ensurePredictionStorage(env.DB);
  const body = await request.json().catch(() => null) as { deviceId?: string; replayAnswer?: string } | null;
  if (!body?.deviceId || !body.replayAnswer) return json({ error: "Replay answer and deviceId are required" }, 400);
  const row = await env.DB.prepare("SELECT payload FROM prediction_records WHERE id = ? AND device_id = ?").bind(predictionId, body.deviceId).first<{ payload: string }>();
  if (!row) return json({ error: "Prediction not found" }, 404);
  const prediction = JSON.parse(row.payload) as StoredPrediction;
  const updated = completeReplay(prediction, body.replayAnswer);
  await env.DB.prepare("UPDATE prediction_records SET updated_at = ?, payload = ? WHERE id = ? AND device_id = ?").bind(updated.updatedAt, JSON.stringify(updated), predictionId, body.deviceId).run();
  return json({ data: updated, mode: "database" }, 200, { "cache-control": "no-store" });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    if (url.pathname === "/api/sports/games") {
      const cached = await defaultCache()?.match(request);
      return withCors(cached ?? await sportsGames(request, env, ctx), request, env);
    }

    if (url.pathname === "/api/sports/markets") {
      const cached = await defaultCache()?.match(request);
      return withCors(cached ?? await sportsMarkets(request, env, ctx), request, env);
    }

    if (url.pathname === "/api/predictions") return withCors(await predictionsCollection(request, env), request, env);
    const replayMatch = url.pathname.match(/^\/api\/predictions\/([^/]+)\/replay$/);
    if (replayMatch) return withCors(await predictionReplay(request, env, decodeURIComponent(replayMatch[1])), request, env);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
