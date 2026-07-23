import { runChatPersistenceContractTests } from "@khoralabs/chat/testing";
import { createTestChatDatabase } from "../index.ts";

runChatPersistenceContractTests("turso", async () => {
  const { persistence } = await createTestChatDatabase();
  return persistence;
});
