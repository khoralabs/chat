import { describe, expect, test } from "bun:test";
import type { Post } from "@khoralabs/chat";
import {
  extractTextFromParts,
  extractToolCallsFromParts,
  formatPostTimestamp,
  guessAttachmentMimeType,
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

  test("extractToolCallsFromParts maps tool states", () => {
    const toolCalls = extractToolCallsFromParts([
      {
        type: "tool-search",
        toolCallId: "tc-1",
        state: "output-available",
        input: { q: "x" },
        output: { ok: true },
      },
    ]);
    expect(toolCalls[0]?.state).toBe("completed");
    expect(toolCalls[0]?.toolName).toBe("search");
  });

  test("postToDisplayMessage skips kickoff metadata", () => {
    expect(
      postToDisplayMessage(
        basePost({ metadata: { kickoff: true }, parts: [{ type: "text", text: "hi" }] }),
      ),
    ).toBeNull();
  });

  test("postToDisplayMessage uses displayText metadata", () => {
    const message = postToDisplayMessage(
      basePost({ metadata: { displayText: "shown" }, parts: [{ type: "text", text: "hidden" }] }),
      { resolveAuthor: () => ({ name: "Zach" }) },
    );
    expect(message?.content).toBe("shown");
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

    expect(message?.content).toBe("");
    expect(message?.status).toBe("streaming");
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
    expect(message?.content).toBe("");
    expect(message?.attachments).toHaveLength(1);
  });

  test("toolStateForDisplay maps ai sdk states", () => {
    expect(toolStateForDisplay("output-available")).toBe("completed");
    expect(toolStateForDisplay("output-error")).toBe("error");
    expect(toolStateForDisplay("input-available")).toBe("running");
  });
});
