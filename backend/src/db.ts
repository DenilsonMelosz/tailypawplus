/**
 * Acesso ao banco. Em producao usa Postgres (Neon) via DATABASE_URL.
 * Sem DATABASE_URL, usa PGlite (Postgres embutido) em ./.data, para rodar
 * localmente sem instalar nada. As duas opcoes aceitam o mesmo SQL.
 */
import pg from "pg";
import { SCHEMA } from "./schema.js";

type Row = Record<string, any>;
interface Driver {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

let driver: Driver;

export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
    driver = { query: (t, p) => pool.query(t, p as any[]) as any };
    console.log("[db] Postgres (DATABASE_URL)");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? "./.data";
    const lite = dir === "memory" ? new PGlite() : new PGlite(dir);
    driver = { query: (t, p) => lite.query(t, p as any[]) as any };
    console.log(`[db] PGlite local (${dir})`);
  }
  for (const stmt of SCHEMA) await driver.query(stmt);
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await driver.query<T>(text, params);
  return r.rows;
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}
