import { describe, expect, test } from "bun:test";
import { sqlCipherKeyFromEnv } from "../../sqlcipher.ts";
import { createChatDatabase } from "./schema.ts";

describe("createChatDatabase plaintext", () => {
  test("opens without key and applies schema", () => {
    const db = createChatDatabase(":memory:");
    try {
      const tables = db
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
        )
        .all()
        .map((r) => r.name);
      expect(tables.includes("chat_channels")).toBe(true);
    } finally {
      db.close();
    }
  });

  test("sqlCipherKeyFromEnv returns undefined when unset", () => {
    expect(sqlCipherKeyFromEnv({})).toBeUndefined();
  });
});
