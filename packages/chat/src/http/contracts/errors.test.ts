import { describe, expect, test } from "bun:test";
import { CHAT_ERROR_CODE, chatErrorCodeForStatus, parseChatErrorEnvelope } from "./errors.ts";

describe("chatErrorCodeForStatus", () => {
  test("maps known statuses", () => {
    expect(chatErrorCodeForStatus(401)).toBe(CHAT_ERROR_CODE.unauthorized);
    expect(chatErrorCodeForStatus(404)).toBe(CHAT_ERROR_CODE.not_found);
    expect(chatErrorCodeForStatus(400)).toBe(CHAT_ERROR_CODE.invalid_request);
    expect(chatErrorCodeForStatus(500)).toBe(CHAT_ERROR_CODE.internal_error);
  });
});

describe("parseChatErrorEnvelope", () => {
  test("parses known code", () => {
    expect(parseChatErrorEnvelope({ error: "nope", code: "not_found" })).toEqual({
      error: "nope",
      code: CHAT_ERROR_CODE.not_found,
    });
  });

  test("omits unknown codes", () => {
    expect(parseChatErrorEnvelope({ error: "nope", code: "future" })).toEqual({ error: "nope" });
  });

  test("rejects bad payloads", () => {
    expect(() => parseChatErrorEnvelope(null)).toThrow(/expected object/);
    expect(() => parseChatErrorEnvelope({ error: 1 })).toThrow(/error must be a string/);
  });
});
