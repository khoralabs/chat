import { runChatPersistenceContractTests } from "../../testing/persistence/contract.ts";
import { createMemoryChatPersistence } from "./memory-persistence.ts";

runChatPersistenceContractTests("memory", () => createMemoryChatPersistence());
