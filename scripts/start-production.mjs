import { cp, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const root = process.cwd();
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
const standalone = path.join(root, ".next", "standalone");
try {
  await access(path.join(standalone, "server.js"));
} catch {
  throw new Error("프로덕션 빌드가 없습니다. npm run build를 먼저 실행해 주세요.");
}
await Promise.all([
  cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true, force: true }),
  cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
    recursive: true,
    force: true,
  }),
]);
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const server = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: option("--hostname") || "127.0.0.1",
    PORT: option("--port") || process.env.PORT || "3000",
    DATABASE_PATH: path.resolve(
      process.env.DATABASE_PATH || path.join(root, "data", "recode.sqlite"),
    ),
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => {
  process.exitCode = code || 0;
});
