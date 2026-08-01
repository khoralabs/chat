import { describe, expect, test } from "bun:test";
import type { Post } from "@khoralabs/chat";
import {
  extractTextFromParts,
  extractToolCallsFromParts,
  formatPostTimestamp,
  guessAttachmentMimeType,
  hasRenderableParts,
  postsToDisplayMessages,
  postToDisplayMessage,
  toolStateForDisplay,
} from "./adapters.ts";

const basePost = (overrides: Partial<Post> = {}): Post =>
  ({
    id: "post-1",
    threadId: "thread-1",
    role: "user",
    parts: [{ type: "text", text: "Hello" }],
    author: { type: "account", id: "user-1" },
    index: 0,
    createdAtMs: 1_700_000_000_000,
    status: "complete",
    versionId: "v1",
    contentHash: "hash",
    lineageHash: "lineage",
    ...overrides,
  }) as Post;

describe("adapters", () => {
  test("extractTextFromParts joins text parts", () => {
    expect(
      extractTextFromParts([
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ]),
    ).toBe("ab");
  });

  test("extractToolCallsFromParts maps tool states and approval", () => {
    const toolCalls = extractToolCallsFromParts([
      {
        type: "tool-search",
        toolCallId: "tc-1",
        state: "output-available",
        input: { q: "x" },
        output: { ok: true },
      },
      {
        type: "tool-delete",
        toolCallId: "tc-2",
        state: "approval-requested",
        input: { path: "/tmp/x" },
        approval: { id: "appr-1" },
      },
    ]);
    expect(toolCalls[0]?.state).toBe("completed");
    expect(toolCalls[0]?.toolName).toBe("search");
    expect(toolCalls[1]?.state).toBe("awaiting-approval");
    expect(toolCalls[1]?.approval).toEqual({ id: "appr-1" });
  });

  test("hasRenderableParts detects text, reasoning, and tools", () => {
    expect(hasRenderableParts([{ type: "step-start" }])).toBe(false);
    expect(hasRenderableParts([{ type: "reasoning", text: "think", state: "done" }])).toBe(true);
    expect(
      hasRenderableParts([
        { type: "tool-x", toolCallId: "1", state: "input-available", input: {} },
      ]),
    ).toBe(true);
  });

  test("postToDisplayMessage skips kickoff metadata", () => {
    expect(
      postToDisplayMessage(
        basePost({ metadata: { kickoff: true }, parts: [{ type: "text", text: "hi" }] }),
      ),
    ).toBeNull();
  });

  test("postToDisplayMessage passes parts and displayText metadata", () => {
    const parts = [{ type: "text" as const, text: "hidden" }];
    const message = postToDisplayMessage(basePost({ metadata: { displayText: "shown" }, parts }), {
      resolveAuthor: () => ({ name: "Zach" }),
    });
    expect(message?.parts).toEqual(parts);
    expect(message?.displayText).toBe("shown");
    expect(message?.author?.name).toBe("Zach");
  });

  test("postToDisplayMessage keeps empty streaming assistant posts", () => {
    const message = postToDisplayMessage(
      basePost({
        role: "assistant",
        parts: [],
        author: { type: "agent", id: "agent-1" },
        status: "streaming",
        streamRevision: 1,
      }),
    );

    expect(message?.parts).toEqual([]);
    expect(message?.status).toBe("streaming");
  });

  test("postToDisplayMessage keeps reasoning-only posts", () => {
    const parts = [{ type: "reasoning" as const, text: "thinking", state: "done" as const }];
    const message = postToDisplayMessage(
      basePost({
        role: "assistant",
        parts,
        author: { type: "agent", id: "agent-1" },
      }),
    );
    expect(message?.parts).toEqual(parts);
  });

  test("postToDisplayMessage round-trips approval-bearing tool parts", () => {
    const parts = [
      {
        type: "tool-delete_file" as const,
        toolCallId: "tc-1",
        state: "approval-requested" as const,
        input: { filePath: "/tmp/x" },
        approval: { id: "appr-1" },
      },
    ];
    const message = postToDisplayMessage(
      basePost({
        role: "assistant",
        parts,
        author: { type: "agent", id: "agent-1" },
      }),
    );
    expect(message?.parts).toEqual(parts);
  });

  test("postsToDisplayMessages filters null entries", () => {
    const messages = postsToDisplayMessages([
      basePost(),
      basePost({ id: "kickoff", metadata: { kickoff: true } }),
    ]);
    expect(messages).toHaveLength(1);
  });

  test("formatPostTimestamp returns a non-empty label", () => {
    expect(formatPostTimestamp(1_700_000_000_000).length).toBeGreaterThan(0);
  });

  test("guessAttachmentMimeType handles common extensions", () => {
    expect(guessAttachmentMimeType("photo.jpg")).toBe("image/jpeg");
    expect(guessAttachmentMimeType("notes.md")).toBe("text/markdown");
  });

  test("postToDisplayMessage maps metadata.sources to source attachments", () => {
    const message = postToDisplayMessage(
      basePost({
        role: "assistant",
        parts: [{ type: "text", text: "Cited." }],
        author: { type: "agent", id: "agent-1" },
        metadata: {
          sources: [
            {
              id: "src-1",
              title: "Spec",
              mediaType: "text/markdown",
              sourceRef: {
                domain: "document",
                document_id: "doc-1",
                content_hash: "a".repeat(64),
              },
            },
          ],
        },
      }),
    );

    expect(message?.attachments).toHaveLength(1);
    expect(message?.attachments?.[0]?.kind).toBe("source");
    expect(message?.attachments?.[0]?.title).toBe("Spec");
    expect(message?.attachments?.[0]?.sourceRef).toMatchObject({ document_id: "doc-1" });
  });

  test("postToDisplayMessage keeps source-only messages", () => {
    const message = postToDisplayMessage(
      basePost({
        role: "assistant",
        parts: [],
        author: { type: "agent", id: "agent-1" },
        metadata: {
          sources: [
            {
              id: "src-1",
              sourceRef: { bucket: "docs", key: "a.md" },
            },
          ],
        },
      }),
    );

    expect(message).not.toBeNull();
    expect(message?.parts).toEqual([]);
    expect(message?.attachments).toHaveLength(1);
  });

  test("toolStateForDisplay maps ai sdk states", () => {
    expect(toolStateForDisplay("output-available")).toBe("completed");
    expect(toolStateForDisplay("output-error")).toBe("error");
    expect(toolStateForDisplay("input-available")).toBe("running");
    expect(toolStateForDisplay("approval-requested")).toBe("awaiting-approval");
    expect(toolStateForDisplay("output-denied")).toBe("denied");
  });
});
