// Shared SQL uses types supported by both SQLite and PostgreSQL.
export const storageSchema = `
CREATE TABLE IF NOT EXISTS learning_progress (
  owner TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  content TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner, lesson_id)
);
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS problem_catalog (
  id TEXT PRIMARY KEY REFERENCES problems(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  domain TEXT NOT NULL,
  language TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  search_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS catalog_domain_date ON problem_catalog(domain,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS catalog_date ON problem_catalog(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS catalog_source_date ON problem_catalog(source,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  operation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  content TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_runs_owner_date ON ai_runs(owner,created_at DESC);
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
DROP INDEX IF EXISTS attempts_owner_date;
CREATE INDEX IF NOT EXISTS attempts_owner_cursor ON attempts(owner, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS attempts_problem_cursor ON attempts(owner,problem_id,created_at DESC,id DESC);
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
);
CREATE INDEX IF NOT EXISTS jobs_owner_kind_state ON jobs(owner,kind,state);
CREATE TABLE IF NOT EXISTS generation_usage (
  request_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  day TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','done')),
  expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS generation_usage_owner_day ON generation_usage(owner,day);
`;

// Applied under the store's migration lock. Defaults preserve existing rows.
export const storageColumns = [
  ["progress", "code_revision", "INTEGER NOT NULL DEFAULT 0"],
  ["jobs", "token", "TEXT NOT NULL DEFAULT ''"],
  ["jobs", "fingerprint", "TEXT NOT NULL DEFAULT ''"],
  ["generation_usage", "token", "TEXT NOT NULL DEFAULT ''"],
];
