import { runChatPersistenceContractTests } from "@khoralabs/chat/testing";
import { createChatDatabase, createSqliteChatPersistence } from "../index.ts";

runChatPersistenceContractTests("sqlite", () => {
  const db = createChatDatabase(":memory:");
  return createSqliteChatPersistence(db);
});
