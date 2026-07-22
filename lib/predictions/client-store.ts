import type { Game, LeagueKey } from "../sports/models.ts";
import type { DataEnvelope } from "../sports/provider.ts";
import { settlePrediction, type StoredPrediction } from "./history.ts";

const DEVICE_KEY = "clearpick-device-id-v1";
const HISTORY_KEY = "clearpick-predictions-v1";

export interface PredictionHistoryEnvelope {
  data: StoredPrediction[];
  mode: "database" | "device";
  warning?: string;
}

export function getDeviceId(storage: Pick<Storage, "getItem" | "setItem">) {
  const existing = storage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(DEVICE_KEY, id);
  return id;
}

function readLocal(storage: Pick<Storage, "getItem">): StoredPrediction[] {
  try {
    const parsed = JSON.parse(storage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as StoredPrediction[] : [];
  } catch {
    return [];
  }
}

function writeLocal(storage: Pick<Storage, "setItem">, predictions: StoredPrediction[]) {
  storage.setItem(HISTORY_KEY, JSON.stringify(predictions));
}

function upsert(items: StoredPrediction[], prediction: StoredPrediction) {
  return [prediction, ...items.filter((item) => item.id !== prediction.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function settleLocalPending(items: StoredPrediction[]): Promise<StoredPrediction[]> {
  const leagues = [...new Set(items.filter((item) => item.status === "pending").map((item) => item.draft.game.leagueId))];
  const games = new Map<string, Game>();
  await Promise.all(leagues.map(async (leagueId: LeagueKey) => {
    try {
      const response = await fetch(`/api/sports/games?league=${encodeURIComponent(leagueId)}`);
      if (!response.ok) return;
      const result = await response.json() as DataEnvelope<Game[]>;
      result.data.forEach((game) => games.set(game.id, game));
    } catch {
      // Device fallback remains pending until a feed is reachable.
    }
  }));
  return items.map((item) => games.has(item.draft.game.id) ? settlePrediction(item, games.get(item.draft.game.id)!) : item);
}

export async function loadPredictionHistory(storage: Storage): Promise<PredictionHistoryEnvelope> {
  const deviceId = getDeviceId(storage);
  try {
    const response = await fetch(`/api/predictions?deviceId=${encodeURIComponent(deviceId)}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Prediction database unavailable");
    const result = await response.json() as PredictionHistoryEnvelope;
    writeLocal(storage, result.data);
    return result;
  } catch {
    const settled = await settleLocalPending(readLocal(storage));
    writeLocal(storage, settled);
    return { data: settled, mode: "device", warning: "History is saved only on this device while the database is unavailable." };
  }
}

export async function savePrediction(storage: Storage, prediction: StoredPrediction): Promise<PredictionHistoryEnvelope> {
  const local = upsert(readLocal(storage), prediction);
  writeLocal(storage, local);
  try {
    const response = await fetch("/api/predictions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(prediction) });
    if (!response.ok) throw new Error("Prediction database unavailable");
    return { data: local, mode: "database" };
  } catch {
    return { data: local, mode: "device", warning: "Prediction saved on this device only." };
  }
}

export async function saveReplay(storage: Storage, prediction: StoredPrediction): Promise<PredictionHistoryEnvelope> {
  const local = upsert(readLocal(storage), prediction);
  writeLocal(storage, local);
  try {
    const response = await fetch(`/api/predictions/${encodeURIComponent(prediction.id)}/replay`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: prediction.deviceId, replayAnswer: prediction.replayAnswer, replayCompletedAt: prediction.replayCompletedAt }) });
    if (!response.ok) throw new Error("Prediction database unavailable");
    return { data: local, mode: "database" };
  } catch {
    return { data: local, mode: "device", warning: "Replay saved on this device only." };
  }
}
