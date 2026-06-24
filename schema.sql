CREATE TABLE IF NOT EXISTS tracked_guilds (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  guild_name TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_settings (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  check_role_id TEXT,
  log_channel_id TEXT,
  ping_user_id TEXT
);
CREATE TABLE IF NOT EXISTS user_tokens (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  token TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW() NOT NULL
);
