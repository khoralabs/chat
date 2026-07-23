export {
  closeLocalSqliteDatabase,
  createLocalSqliteDatabase,
  createMemorySqliteDatabase,
} from "./persistence/local-sqlite.ts";
export { createTursoChatPersistence, TursoChatPersistence } from "./persistence/persistence.ts";
export { ensureChatSchema } from "./persistence/schema.ts";
export { createTursoDatabase, type SqlDatabase, type TursoConfig } from "./persistence/sql.ts";

import { createMemorySqliteDatabase } from "./persistence/local-sqlite.ts";
import { createTursoChatPersistence } from "./persistence/persistence.ts";
import { ensureChatSchema } from "./persistence/schema.ts";

export async function createTestChatDatabase(): Promise<{
  db: import("./persistence/sql.ts").SqlDatabase;
  persistence: ReturnType<typeof createTursoChatPersistence>;
}> {
  const db = createMemorySqliteDatabase();
  await ensureChatSchema(db);
  return { db, persistence: createTursoChatPersistence(db) };
}
