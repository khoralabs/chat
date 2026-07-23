import { describe, expect, test } from "bun:test";
import { ChatNotFoundError, isChatNotFoundError } from "./errors.ts";

describe("isChatNotFoundError", () => {
  test("accepts ChatNotFoundError instances", () => {
    expect(isChatNotFoundError(new ChatNotFoundError("channel", "harness-network"))).toBe(true);
  });

  test("accepts duck-typed errors from another bundle copy of the class", () => {
    // Multi-entrypoint bun builds inline a separate ChatNotFoundError per entry;
    // instanceof against the consumer's copy fails, but name/code/resource still match.
    class OtherBundleChatNotFoundError extends Error {
      readonly code = "not_found";
      readonly resource: string;
      readonly resourceId: string;
      constructor(resource: string, resourceId: string) {
        super(`${resource} not found: ${resourceId}`);
        this.name = "ChatNotFoundError";
        this.resource = resource;
        this.resourceId = resourceId;
      }
    }
    const error = new OtherBundleChatNotFoundError("channel", "harness-network");
    expect(error instanceof ChatNotFoundError).toBe(false);
    expect(isChatNotFoundError(error)).toBe(true);
  });

  test("rejects unrelated errors", () => {
    expect(isChatNotFoundError(new Error("channel not found: x"))).toBe(false);
    expect(isChatNotFoundError({ name: "ChatNotFoundError" })).toBe(false);
  });
});
