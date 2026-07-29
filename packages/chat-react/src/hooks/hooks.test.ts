import { describe, expect, test } from "bun:test";
import { showAgentLoading } from "./use-agent-loading.ts";

describe("use-agent-loading", () => {
  test("shows loading after user submit", () => {
    expect(showAgentLoading(false, [{ role: "user" }], "submitted")).toBe(true);
  });

  test("hides loading when ready", () => {
    expect(showAgentLoading(false, [{ role: "user" }], "ready")).toBe(false);
  });

  test("shows loading for awaiting opening kickoff", () => {
    expect(showAgentLoading(true, [], "submitted")).toBe(true);
  });
});
