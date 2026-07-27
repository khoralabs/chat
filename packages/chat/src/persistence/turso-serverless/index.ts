export {
  CHAT_SQLCIPHER_ENV,
  DEV_SQLCIPHER_KEY,
  openChatSqliteDatabase,
  sqlCipherKeyFromEnv,
} from "../sqlcipher.ts";
export {
  type CreateLocalSqliteDatabaseOptions,
  closeLocalSqliteDatabase,
  createLocalSqliteDatabase,
  createMemorySqliteDatabase,
} from "./persistence/local-sqlite.ts";
export { createTursoChatPersistence, TursoChatPersistence } from "./persistence/persistence.ts";
export { ensureChatSchema } from "./persistence/schema.ts";
export { createTursoDatabase, type SqlDatabase, type TursoConfig } from "./persistence/sql.ts";

import { DEV_SQLCIPHER_KEY } from "../sqlcipher.ts";
import { createMemorySqliteDatabase } from "./persistence/local-sqlite.ts";
import { createTursoChatPersistence } from "./persistence/persistence.ts";
import { ensureChatSchema } from "./persistence/schema.ts";

export async function createTestChatDatabase(): Promise<{
  db: import("./persistence/sql.ts").SqlDatabase;
  persistence: ReturnType<typeof createTursoChatPersistence>;
}> {
  const db = createMemorySqliteDatabase({ sqlCipherKey: DEV_SQLCIPHER_KEY });
  await ensureChatSchema(db);
  return { db, persistence: createTursoChatPersistence(db) };
}
