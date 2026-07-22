import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const predictionRecords = sqliteTable("prediction_records", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  status: text("status").notNull(),
  leagueId: text("league_id").notNull(),
  gameId: text("game_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  payload: text("payload").notNull(),
}, (table) => [
  index("prediction_records_device_created_idx").on(table.deviceId, table.createdAt),
  index("prediction_records_status_idx").on(table.status),
]);
