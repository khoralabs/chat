import type { SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { openChatSqliteDatabase } from "../../sqlcipher.ts";
import { CHAT_SCHEMA } from "./schema.ts";
import type { SqlDatabase } from "./sql.ts";

class BunSqliteDatabase implements SqlDatabase {
  constructor(private readonly db: ReturnType<typeof openChatSqliteDatabase>) {}

  prepare(sql: string) {
    const stmt = this.db.prepare(sql);
    return {
      run: async (args: unknown[] = []) => {
        stmt.run(...(args as SQLQueryBindings[]));
      },
      all: async <T>(args: unknown[] = []) => stmt.all(...(args as SQLQueryBindings[])) as T[],
      get: async <T>(args: unknown[] = []) =>
        (stmt.get(...(args as SQLQueryBindings[])) as T | null) ?? null,
    };
  }

  exec(sql: string) {
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
  }
}

function applyMigrationsSync(db: ReturnType<typeof openChatSqliteDatabase>): void {
  for (const statement of [
    "ALTER TABLE chat_posts ADD COLUMN stream_model TEXT",
    "ALTER TABLE chat_posts ADD COLUMN stream_usage TEXT",
    "ALTER TABLE chat_post_stream_events ADD COLUMN model TEXT",
    "ALTER TABLE chat_post_stream_events ADD COLUMN usage TEXT",
    "ALTER TABLE chat_post_versions ADD COLUMN model TEXT",
    "ALTER TABLE chat_post_versions ADD COLUMN usage TEXT",
  ]) {
    try {
      db.run(statement);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
        throw error;
      }
    }
  }
}

export type CreateLocalSqliteDatabaseOptions = {
  /** When set, encrypt with SQLCipher; omit (and leave env unset) for plaintext. */
  sqlCipherKey?: string;
};

export function createLocalSqliteDatabase(
  dbPath: string,
  opts?: CreateLocalSqliteDatabaseOptions,
): SqlDatabase {
  const resolved = path.resolve(dbPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  const db = openChatSqliteDatabase(resolved, { create: true }, opts?.sqlCipherKey);
  db.run(CHAT_SCHEMA);
  applyMigrationsSync(db);
  return new BunSqliteDatabase(db);
}

export function createMemorySqliteDatabase(opts?: CreateLocalSqliteDatabaseOptions): SqlDatabase {
  const db = openChatSqliteDatabase(":memory:", undefined, opts?.sqlCipherKey);
  db.run(CHAT_SCHEMA);
  applyMigrationsSync(db);
  return new BunSqliteDatabase(db);
}

export function closeLocalSqliteDatabase(db: SqlDatabase): void {
  if (db instanceof BunSqliteDatabase) {
    db.close();
  }
}
