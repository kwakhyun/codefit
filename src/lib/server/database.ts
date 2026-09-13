import { PostgresStore, connectPostgres } from "./postgres-store";

let remote: Promise<PostgresStore> | undefined;
export async function getStore() {
  if (process.env.DATABASE_URL) {
    if (!remote) {
      remote = (async () => {
        const sql = connectPostgres(process.env.DATABASE_URL!);
        try {
          const store = new PostgresStore(sql);
          await store.initialize();
          return store;
        } catch (error) { await sql.end(); throw error; }
      })().catch(error => { remote = undefined; throw error; });
    }
    return remote;
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is required on Vercel");
  const { getStore: getLocalStore } = await import("./store");
  return getLocalStore();
}
