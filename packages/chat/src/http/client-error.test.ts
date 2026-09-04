import { describe, expect, test } from "bun:test";
import { ChatHttpClientError, throwChatHttpClientError } from "./client-error.ts";
import { CHAT_ERROR_CODE } from "./contracts/errors.ts";

describe("ChatHttpClientError", () => {
  test("sets status and code", () => {
    const err = new ChatHttpClientError("nope", 400, {
      code: CHAT_ERROR_CODE.invalid_request,
      bodyText: "{}",
    });
    expect(err.name).toBe("ChatHttpClientError");
    expect(err.status).toBe(400);
    expect(err.code).toBe(CHAT_ERROR_CODE.invalid_request);
  });
});

describe("throwChatHttpClientError", () => {
  test("parses envelope code", () => {
    expect(() =>
      throwChatHttpClientError(
        401,
        "Unauthorized",
        '{"error":"Unauthorized","code":"unauthorized"}',
      ),
    ).toThrow(ChatHttpClientError);
    try {
      throwChatHttpClientError(
        401,
        "Unauthorized",
        '{"error":"Unauthorized","code":"unauthorized"}',
      );
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ChatHttpClientError);
      const err = e as ChatHttpClientError;
      expect(err.message).toBe("Unauthorized");
      expect(err.status).toBe(401);
      expect(err.code).toBe(CHAT_ERROR_CODE.unauthorized);
    }
  });

  test("falls back for null-ish body", () => {
    try {
      throwChatHttpClientError(500, "Internal Server Error", "");
      expect.unreachable();
    } catch (e) {
      const err = e as ChatHttpClientError;
      expect(err.message).toBe("Internal Server Error");
      expect(err.code).toBe(CHAT_ERROR_CODE.internal_error);
    }
  });
});
