import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const trackedGuilds = pgTable("tracked_guilds", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  guildName: text("guild_name").notNull(),
  addedBy: text("added_by").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const guildSettings = pgTable("guild_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  checkRoleId: text("check_role_id"),
  logChannelId: text("log_channel_id"),
  pingUserId: text("ping_user_id"),
});

export const userTokens = pgTable("user_tokens", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  token: text("token").notNull(),
  addedBy: text("added_by").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

const schema = { trackedGuilds, guildSettings, userTokens };
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
