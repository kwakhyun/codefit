// Better Auth 1.7.4 schema. Dates use each driver's native representation.
export function authSchema(dialect) {
  const date = dialect === "postgres" ? "timestamptz" : "date";
  const bool = dialect === "postgres" ? "boolean" : "integer";
  return `
CREATE TABLE IF NOT EXISTS auth_user (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  "emailVerified" ${bool} NOT NULL, image TEXT, "createdAt" ${date} NOT NULL,
  "updatedAt" ${date} NOT NULL, bio TEXT
);
CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY, "expiresAt" ${date} NOT NULL, token TEXT NOT NULL UNIQUE,
  "createdAt" ${date} NOT NULL, "updatedAt" ${date} NOT NULL, "ipAddress" TEXT,
  "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS auth_account (
  id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT,
  "accessTokenExpiresAt" ${date}, "refreshTokenExpiresAt" ${date}, scope TEXT,
  password TEXT, "createdAt" ${date} NOT NULL, "updatedAt" ${date} NOT NULL,
  UNIQUE("providerId", "accountId")
);
CREATE TABLE IF NOT EXISTS auth_verification (
  id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
  "expiresAt" ${date} NOT NULL, "createdAt" ${date} NOT NULL, "updatedAt" ${date} NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_rate_limit (
  id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, "lastRequest" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_session_userId_idx" ON auth_session("userId");
CREATE INDEX IF NOT EXISTS "auth_account_userId_idx" ON auth_account("userId");
CREATE INDEX IF NOT EXISTS "auth_verification_identifier_idx" ON auth_verification(identifier);
`;
}
