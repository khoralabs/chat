import { Database, type DatabaseOptions } from "bun:sqlite";
import { openEncryptedDatabaseSync, SqliteCryptoError } from "@khoralabs/sqlite-crypto";

export const CHAT_SQLCIPHER_ENV = "CHAT_SQLCIPHER_KEY";
/** Fixed key for unit/integration tests only — not used as a runtime default. */
export const DEV_SQLCIPHER_KEY = "chat-dev-sqlcipher-key!";

/**
 * Resolve `CHAT_SQLCIPHER_KEY` when set (≥16 chars); otherwise `undefined` (plaintext).
 */
export function sqlCipherKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env[CHAT_SQLCIPHER_ENV]?.trim();
  if (key === undefined || key.length === 0) return undefined;
  if (key.length < 16) {
    throw new SqliteCryptoError(`${CHAT_SQLCIPHER_ENV} must be at least 16 characters`);
  }
  return key;
}

/** Ignore "SQLite already loaded" when a prior plaintext open raced SQLCipher setCustomSQLite. */
function softenSetCustomSqlite(): void {
  const original = Database.setCustomSQLite.bind(Database);
  Database.setCustomSQLite = ((libPath: string) => {
    try {
      original(libPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/SQLite already loaded/i.test(msg)) throw e;
    }
  }) as typeof Database.setCustomSQLite;
}

/**
 * Open Bun SQLite. Pass `sqlCipherKey` (or set `CHAT_SQLCIPHER_KEY`) for SQLCipher;
 * omit both for plaintext.
 */
export function openChatSqliteDatabase(
  filename: string,
  options?: DatabaseOptions,
  sqlCipherKey?: string,
): Database {
  const key = sqlCipherKey ?? sqlCipherKeyFromEnv();
  const openOptions = { create: true, ...options };
  if (typeof key === "string" && key.length > 0) {
    softenSetCustomSqlite();
    return openEncryptedDatabaseSync(filename, openOptions, key);
  }
  return new Database(filename, openOptions);
}
