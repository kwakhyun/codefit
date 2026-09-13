import { DatabaseSync, backup } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
const source = path.resolve(process.env.DATABASE_PATH || "data/recode.sqlite");
const target = path.resolve(process.argv[2] || `data/backups/recode-${new Date().toISOString().replaceAll(":", "-")}.sqlite`);
if (!existsSync(source)) throw new Error("데이터베이스가 없습니다. 앱을 먼저 실행해 주세요.");
if (source === target || existsSync(target)) throw new Error("새 백업 파일 경로를 지정해 주세요. 기존 파일은 덮어쓰지 않습니다.");
await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(source, { readOnly: true });
try { await backup(db, target); console.log(`데이터베이스 백업 완료: ${target}`); }
finally { db.close(); }
