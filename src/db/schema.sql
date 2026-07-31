-- KickIQ Database Schema
-- Run via: bun run src/db/migrate.ts

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS athletes (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('practice', 'game')),
  notes TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kicks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  distance INTEGER NOT NULL,
  hash TEXT NOT NULL CHECK(hash IN ('left', 'center', 'right')),
  result TEXT NOT NULL CHECK(result IN ('made', 'missed', 'blocked')),
  miss_type TEXT CHECK(miss_type IN ('short', 'wide_left', 'wide_right', 'crossbar', 'blocked', NULL)),
  landing_zone TEXT CHECK(landing_zone IN ('goalpost', 'left', 'right', 'short', NULL)),
  operation_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_athletes_team ON athletes(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_athlete ON sessions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_kicks_session ON kicks(session_id);
CREATE INDEX IF NOT EXISTS idx_kicks_athlete ON kicks(athlete_id);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'coach' CHECK(role IN ('admin', 'coach', 'kicker', 'viewer')),
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
