import { describe, expect, test } from "bun:test";
import { mergePostIntoList } from "./react-client.ts";
import type { Post } from "./types.ts";

describe("mergePostIntoList", () => {
  test("merges streamed post deltas into local list", () => {
    const streaming = {
      id: "m1",
      role: "assistant" as const,
      status: "streaming" as const,
      parts: [{ type: "text" as const, text: "hel", state: "streaming" as const }],
      threadId: "t1",
      author: { type: "agent", id: "a1" },
      index: 1,
      streamRevision: 1,
      createdAtMs: 1,
    } as Post;
    const updated = {
      ...streaming,
      parts: [{ type: "text" as const, text: "hello", state: "streaming" as const }],
      streamRevision: 2,
    } as Post;
    expect(mergePostIntoList([], streaming)).toEqual([streaming]);
    expect(mergePostIntoList([streaming], updated)).toEqual([updated]);
  });

  test("appends and sorts by index", () => {
    const a = { id: "a", index: 1, threadId: "t1" } as Post;
    const b = { id: "b", index: 0, threadId: "t1" } as Post;
    expect(mergePostIntoList([a], b).map((p) => p.id)).toEqual(["b", "a"]);
  });
});
