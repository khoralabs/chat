import { describe, expect, test } from "bun:test";
import type { ChatSigner, ChatVerifier, ScopeRef, SignedEnvelope } from "@khoralabs/chat-core";

import { createMemoryChatPersistence } from "./memory-persistence.ts";
import {
  prepareAppendForSigning,
  signPreparedAppendPost,
  withSignedChatPersistence,
} from "./signed-persistence.ts";

function createTestCrypto(): { signer: ChatSigner; verifier: ChatVerifier } {
  const secrets = new Map<string, string>();

  function keyFor(scope: ScopeRef): string {
    return `${scope.type}:${scope.id}`;
  }

  return {
    signer: {
      async sign(payload: Uint8Array, author: ScopeRef): Promise<SignedEnvelope> {
        const secret = secrets.get(keyFor(author)) ?? `secret:${keyFor(author)}`;
        secrets.set(keyFor(author), secret);
        const body = new TextDecoder().decode(payload);
        return {
          algorithm: "test-hmac",
          signer: author,
          signature: `${secret}:${body}`,
          signedAtMs: Date.now(),
        };
      },
    },
    verifier: {
      async verify(payload: Uint8Array, envelope: SignedEnvelope): Promise<boolean> {
        if (envelope.algorithm !== "test-hmac") return false;
        const secret = secrets.get(keyFor(envelope.signer));
        if (secret === undefined) return false;
        const body = new TextDecoder().decode(payload);
        return envelope.signature === `${secret}:${body}`;
      },
    },
  };
}

describe("withSignedChatPersistence", () => {
  test("unsigned base persistence still allows unsigned append", async () => {
    const persistence = createMemoryChatPersistence();
    const channel = await persistence.createChannel({});
    const thread = await persistence.createThread({
      root: { type: "channel", channelId: channel.id },
    });
    const result = await persistence.appendPost({
      threadId: thread.id,
      author: { type: "account", id: "u1" },
      message: { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
    });
    expect(result.ok).toBe(true);
  });

  test("append without signature fails under wrapper", async () => {
    const { signer, verifier } = createTestCrypto();
    const persistence = withSignedChatPersistence(createMemoryChatPersistence(), {
      signer,
      verifier,
    });
    const channel = await persistence.createChannel({});
    const thread = await persistence.createThread({
      root: { type: "channel", channelId: channel.id },
    });

    await expect(
      persistence.appendPost({
        threadId: thread.id,
        author: { type: "account", id: "u1" },
        message: { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
      }),
    ).rejects.toThrow(/signed envelope/);
  });

  test("append with valid signature succeeds for non-agent scopes", async () => {
    const { signer, verifier } = createTestCrypto();
    const base = createMemoryChatPersistence();
    const persistence = withSignedChatPersistence(base, { signer, verifier });
    const channel = await persistence.createChannel({});
    const thread = await persistence.createThread({
      root: { type: "channel", channelId: channel.id },
    });
    const author = { type: "account", id: "u1" };
    const appendInput = {
      threadId: thread.id,
      author,
      message: {
        id: "m1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "hello" }],
      },
    };
    const prepared = await prepareAppendForSigning(persistence, appendInput);
    const signature = await signPreparedAppendPost(signer, author, prepared);

    const result = await persistence.appendPost({
      ...appendInput,
      message: prepared.message,
      versionId: prepared.versionId,
      createdAtMs: prepared.createdAtMs,
      signature,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.post.status !== "complete") return;
    expect(result.post.signature).toEqual(signature);
  });

  test("append with mismatched signer scope fails", async () => {
    const { signer, verifier } = createTestCrypto();
    const persistence = withSignedChatPersistence(createMemoryChatPersistence(), {
      signer,
      verifier,
    });
    const channel = await persistence.createChannel({});
    const thread = await persistence.createThread({
      root: { type: "channel", channelId: channel.id },
    });
    const author = { type: "account", id: "u1" };
    const appendInput = {
      threadId: thread.id,
      author,
      message: {
        id: "m1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "hello" }],
      },
    };
    const prepared = await prepareAppendForSigning(persistence, appendInput);
    const signature = await signPreparedAppendPost(
      signer,
      { type: "account", id: "other" },
      prepared,
    );

    await expect(
      persistence.appendPost({
        ...appendInput,
        message: prepared.message,
        versionId: prepared.versionId,
        createdAtMs: prepared.createdAtMs,
        signature,
      }),
    ).rejects.toThrow(/must match author/);
  });

  test("stream complete auto-signs and persists signature", async () => {
    const { signer, verifier } = createTestCrypto();
    const persistence = withSignedChatPersistence(createMemoryChatPersistence(), {
      signer,
      verifier,
    });
    const channel = await persistence.createChannel({});
    const thread = await persistence.createThread({
      root: { type: "channel", channelId: channel.id },
    });
    const author = { type: "account", id: "agent-bot" };

    const started = await persistence.startStreamedPost({
      threadId: thread.id,
      author,
      message: {
        id: "stream-1",
        role: "assistant",
        parts: [{ type: "text", text: "hi", state: "streaming" }],
      },
    });
    await persistence.applyPostDelta({
      postId: started.post.id,
      message: {
        id: started.post.id,
        role: "assistant",
        parts: [{ type: "text", text: "hi there", state: "streaming" }],
      },
    });

    const completed = await persistence.completeStreamedPost({
      postId: started.post.id,
      expectedRevision: 2,
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.post.signature).toBeDefined();
    expect(completed.post.signature?.signer).toEqual(author);

    const version = await persistence.getPostVersion(completed.post.versionId);
    expect(version?.signature).toEqual(completed.post.signature);
  });

  test("signPreparedAppendPost produces test-hmac envelope", async () => {
    const { signer } = createTestCrypto();
    const persistence = createMemoryChatPersistence();
    const channel = await persistence.createChannel({});
    const thread = await persistence.createThread({
      root: { type: "channel", channelId: channel.id },
    });
    const author = { type: "user", id: "u2" };
    const prepared = await prepareAppendForSigning(persistence, {
      threadId: thread.id,
      author,
      message: { id: "m2", role: "user", parts: [{ type: "text", text: "bytes" }] },
    });
    const envelope = await signPreparedAppendPost(signer, author, prepared);
    expect(envelope.algorithm).toBe("test-hmac");
    expect(envelope.signer).toEqual(author);
    expect(envelope.signature.length).toBeGreaterThan(0);
  });
});
