import { runChatPersistenceContractTests } from "@khoralabs/chat/testing";
import { createChatDatabase, createSqliteChatPersistence, DEV_SQLCIPHER_KEY } from "../index.ts";

runChatPersistenceContractTests("sqlite", () => {
  const db = createChatDatabase(":memory:", { sqlCipherKey: DEV_SQLCIPHER_KEY });
  return createSqliteChatPersistence(db);
});
