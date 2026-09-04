import { describe, expect, test } from "bun:test";
import { createMemoryChatPersistence } from "@khoralabs/chat/persistence";
import { base58Encode } from "@khoralabs/relay/crypto/encoding";
import { getPublicKeyAsync, signAsync } from "@noble/ed25519";

import type { ChatServiceClient } from "../http/client.ts";
import { createChatService } from "../service.ts";
import { createSignedChatBackend } from "./backend.ts";
import { createDidKeyChatCrypto, DID_KEY_CHAT_SIGNATURE_ALGORITHM } from "./chat-crypto.ts";

function didKeyFromPublicKey(pubKey: Uint8Array): string {
  const prefixed = new Uint8Array(2 + pubKey.length);
  prefixed[0] = 0xed;
  prefixed[1] = 0x01;
  prefixed.set(pubKey, 2);
  return `did:key:z${base58Encode(prefixed)}`;
}

async function createTestRelaySigner() {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  const publicKey = await getPublicKeyAsync(privateKey);
  const did = didKeyFromPublicKey(publicKey);
  return {
    did,
    sign: (payload: Uint8Array) => signAsync(payload, privateKey),
  };
}

function asChatServiceClient(service: ReturnType<typeof createChatService>): ChatServiceClient {
  return {
    ...service,
    subscribeToThread() {
      return () => {};
    },
  };
}

describe("createDidKeyChatCrypto", () => {
  test("signs and verifies with did:key ed25519", async () => {
    const relay = await createTestRelaySigner();
    const { signer, verifier } = createDidKeyChatCrypto(async (did) =>
      did === relay.did ? relay : undefined,
    );
    const author = { type: "agent" as const, id: relay.did };
    const payload = new TextEncoder().encode("hello chat");

    const envelope = await signer.sign(payload, author);
    expect(envelope.algorithm).toBe(DID_KEY_CHAT_SIGNATURE_ALGORITHM);
    expect(envelope.signer).toEqual(author);
    expect(await verifier.verify(payload, envelope)).toBe(true);
    expect(await verifier.verify(new TextEncoder().encode("tampered"), envelope)).toBe(false);
  });

  test("returns false for malformed signatures instead of rejecting", async () => {
    const relay = await createTestRelaySigner();
    const { verifier } = createDidKeyChatCrypto(async (did) =>
      did === relay.did ? relay : undefined,
    );
    const ok = await verifier.verify(new TextEncoder().encode("payload"), {
      algorithm: DID_KEY_CHAT_SIGNATURE_ALGORITHM,
      signer: { type: "agent", id: relay.did },
      signature: "not-valid-base64url!!!",
      signedAtMs: Date.now(),
    });
    expect(ok).toBe(false);
  });

  test("throws when no signing key is available", async () => {
    const { signer } = createDidKeyChatCrypto(async () => undefined);
    await expect(
      signer.sign(new TextEncoder().encode("x"), { type: "agent", id: "did:key:missing" }),
    ).rejects.toThrow(/no signing key/);
  });
});

describe("createSignedChatBackend", () => {
  test("requires a non-empty channelId", () => {
    expect(() =>
      createSignedChatBackend({
        client: {} as never,
        resolveSigner: async () => undefined,
        channelId: "   ",
      }),
    ).toThrow(/channelId is required/);
  });

  test("createThread, sendMessage, grantAccess, listPosts, listThreads", async () => {
    const agent = await createTestRelaySigner();
    const peer = await createTestRelaySigner();
    const service = createChatService(createMemoryChatPersistence());
    const backend = createSignedChatBackend({
      client: asChatServiceClient(service),
      resolveSigner: async (did) => (did === agent.did ? agent : undefined),
      channelId: "agent-channel",
      createChannelMetadata: { title: "Agents" },
    });
    await backend.ready;

    const chat = backend.forAgent(agent.did);
    const thread = await chat.createThread({ id: "t1" });
    expect(thread.id).toBe("t1");

    await chat.grantAccess(thread.id, { type: "agent", id: peer.did });
    const participants = await chat.listParticipants(thread.id);
    expect(participants).toContainEqual({ type: "agent", id: agent.did });
    expect(participants).toContainEqual({ type: "agent", id: peer.did });

    const post = await chat.sendMessage(thread.id, { text: "hello" });
    expect(post.parts[0]).toEqual({ type: "text", text: "hello" });

    const posts = await chat.listPosts(thread.id);
    expect(posts.items).toHaveLength(1);

    const threads = await chat.listThreads();
    expect(threads.items.some((t) => t.id === thread.id)).toBe(true);

    const got = await chat.getThread(thread.id);
    expect(got.id).toBe(thread.id);
  });

  test("non-participants are rejected from thread operations", async () => {
    const owner = await createTestRelaySigner();
    const outsider = await createTestRelaySigner();
    const service = createChatService(createMemoryChatPersistence());
    const backend = createSignedChatBackend({
      client: asChatServiceClient(service),
      resolveSigner: async (did) => {
        if (did === owner.did) return owner;
        if (did === outsider.did) return outsider;
        return undefined;
      },
      channelId: "acl-channel",
    });
    await backend.ready;

    const ownerChat = backend.forAgent(owner.did);
    const thread = await ownerChat.createThread({ id: "acl-t1" });
    const outsiderChat = backend.forAgent(outsider.did);

    await expect(outsiderChat.sendMessage(thread.id, { text: "nope" })).rejects.toThrow(
      /does not have access/,
    );
    await expect(outsiderChat.listPosts(thread.id)).rejects.toThrow(/does not have access/);
    await expect(outsiderChat.getThread(thread.id)).rejects.toThrow(/does not have access/);
    await expect(outsiderChat.listParticipants(thread.id)).rejects.toThrow(/does not have access/);
    await expect(
      outsiderChat.grantAccess(thread.id, { type: "agent", id: "did:key:other" }),
    ).rejects.toThrow(/does not have access/);
  });
});
