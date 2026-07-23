import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMemoryChatPersistence } from "@khoralabs/chat/persistence";
import type { SignedEnvelope } from "../domain.ts";

import { createChatClient } from "./client.ts";
import { resolveChatDbPath } from "./config.ts";
import { createChatRoutesWithParams, dispatchChatRoute } from "./routes.ts";
import { createChatHttpRuntime } from "./service.ts";

const TEST_TOKEN = "test-chat-token";
let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "chat-http-test-"));
  process.env.CHAT_DATA_DIR = dataDir;
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.CHAT_DATA_DIR;
  delete process.env.CHAT_DB_PATH;
});

function createTestClient() {
  const runtime = createChatHttpRuntime({
    persistence: createMemoryChatPersistence(),
  });
  const routes = createChatRoutesWithParams(runtime.service, TEST_TOKEN);
  return createChatClient({
    baseUrl: "http://chat.test",
    token: TEST_TOKEN,
    fetchFn: (req, init) => {
      const request =
        req instanceof Request ? new Request(req, init) : new Request(req.toString(), init);
      return dispatchChatRoute(routes, request);
    },
    subscribeToThread: runtime.subscribeToThread,
  });
}

test("createChatHttpRuntime wires channels and threads", async () => {
  const client = createTestClient();
  await client.createChannel({ id: "ch-1", metadata: { title: "Demo" } });
  await client.createThread({
    id: "th-1",
    root: { type: "channel", channelId: "ch-1" },
  });
  expect(await client.getThread("th-1")).toMatchObject({ id: "th-1" });
});

test("streamed post lifecycle works via routes", async () => {
  const client = createTestClient();
  await client.createChannel({ id: "ch-stream" });
  await client.createThread({
    id: "th-stream",
    root: { type: "channel", channelId: "ch-stream" },
  });

  const started = await client.startStreamedPost({
    threadId: "th-stream",
    author: { type: "agent", id: "agent-1" },
    message: { id: "post-1", role: "assistant", parts: [{ type: "text", text: "" }] },
  });

  await client.applyPostDelta({
    postId: started.post.id,
    message: {
      id: started.post.id,
      role: "assistant",
      parts: [{ type: "text", text: "hello" }],
    },
    expectedRevision: started.revision,
  });

  const completed = await client.completeStreamedPost({
    postId: started.post.id,
    expectedRevision: started.revision + 1,
  });
  expect(completed.post.status).toBe("complete");
});

test("tip, participants, and setPostVersionSignature are exposed", async () => {
  const client = createTestClient();
  await client.createChannel({ id: "ch-acl" });
  await client.createThread({
    id: "th-acl",
    root: { type: "channel", channelId: "ch-acl" },
  });

  expect(await client.getThreadTip("th-acl")).toBeNull();

  await client.addThreadParticipant({
    threadId: "th-acl",
    scope: { type: "agent", id: "agent-a" },
    role: "owner",
    actor: { type: "agent", id: "agent-a" },
  });
  const participants = await client.listThreadParticipants("th-acl");
  expect(participants).toEqual([{ type: "agent", id: "agent-a" }]);

  const appended = await client.appendPost({
    threadId: "th-acl",
    author: { type: "agent", id: "agent-a" },
    message: {
      id: "msg-1",
      role: "user",
      parts: [{ type: "text", text: "hi" }],
    },
  });
  expect(appended.post.status).toBe("complete");
  if (appended.post.status !== "complete") throw new Error("expected complete post");

  const tip = await client.getThreadTip("th-acl");
  expect(tip?.id).toBe(appended.post.versionId);

  const signature: SignedEnvelope = {
    algorithm: "test",
    signer: { type: "agent", id: "agent-a" },
    signature: "sig",
    signedAtMs: Date.now(),
  };
  await client.setPostVersionSignature(appended.post.versionId, signature);
  const posts = await client.listPosts({ threadId: "th-acl" });
  const first = posts.items[0];
  expect(first?.status).toBe("complete");
  if (first?.status !== "complete") throw new Error("expected complete post");
  expect(first.signature).toEqual(signature);
});

test("env db path resolves under CHAT_DATA_DIR", () => {
  expect(resolveChatDbPath()).toContain(path.join(dataDir, "chat.db"));
});
