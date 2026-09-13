// Shared SQL uses types supported by both SQLite and PostgreSQL.
export const storageSchema = `
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  owner TEXT NOT NULL,
  problem_id TEXT NOT NULL REFERENCES problems(id),
  code TEXT,
  bookmarked INTEGER NOT NULL DEFAULT 0,
  hints_viewed INTEGER NOT NULL DEFAULT 0,
  solution_viewed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner, problem_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  problem_id TEXT NOT NULL REFERENCES problems(id),
  code TEXT NOT NULL,
  review TEXT NOT NULL,
  assisted INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_owner_date ON attempts(owner, created_at DESC);
CREATE TABLE IF NOT EXISTS limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  result TEXT,
  expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS legacy (
  owner TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);`;
