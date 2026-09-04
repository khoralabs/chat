import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMemoryChatPersistence } from "@khoralabs/chat/persistence";
import { createChatClient } from "./client.ts";
import { ChatHttpClientError } from "./client-error.ts";
import { CHAT_ERROR_CODE } from "./contracts/errors.ts";
import {
  CHAT_HTTP_PATH,
  CHAT_PROTOCOL_VERSION,
  type ChatHealthResponse,
  chatPostAbortPath,
  chatPostCompletePath,
  chatPostDeltasPath,
  chatRouteKey,
  chatThreadWsPath,
} from "./contracts/http.ts";
import { createChatRoutesWithParams, dispatchChatRoute } from "./routes.ts";
import { createChatHttpRuntime } from "./service.ts";

const TEST_TOKEN = "boundary-chat-token";
let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "chat-boundary-"));
  process.env.CHAT_DATA_DIR = dataDir;
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.CHAT_DATA_DIR;
  delete process.env.CHAT_DB_PATH;
});

describe("client↔routes boundary contracts", () => {
  test("path builders stay aligned with route templates", () => {
    expect(chatRouteKey("GET", CHAT_HTTP_PATH.health)).toBe("GET /health");
    expect(chatRouteKey("POST", CHAT_HTTP_PATH.channelsGet)).toBe("POST /channels/get");
    expect(chatPostDeltasPath("p1")).toBe("/internal/chat/posts/p1/deltas");
    expect(chatPostCompletePath("p1")).toBe("/internal/chat/posts/p1/complete");
    expect(chatPostAbortPath("p1")).toBe("/internal/chat/posts/p1/abort");
    expect(chatThreadWsPath("th-1")).toBe("/ws/threads/th-1");
  });

  test("GET /health returns shared protocol version", async () => {
    const runtime = createChatHttpRuntime({
      persistence: createMemoryChatPersistence(),
    });
    const routes = createChatRoutesWithParams(runtime.service, TEST_TOKEN);
    try {
      const res = await dispatchChatRoute(
        routes,
        new Request(`http://boundary.test${CHAT_HTTP_PATH.health}`, { method: "GET" }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ChatHealthResponse;
      expect(body).toEqual({ ok: true, version: CHAT_PROTOCOL_VERSION });
    } finally {
      runtime.close();
    }
  });

  test("unauthorized surfaces ChatHttpClientError with unauthorized code", async () => {
    const runtime = createChatHttpRuntime({
      persistence: createMemoryChatPersistence(),
    });
    const routes = createChatRoutesWithParams(runtime.service, TEST_TOKEN);
    const client = createChatClient({
      baseUrl: "http://boundary.test",
      token: "wrong-token",
      fetchFn: (req, init) => {
        const request =
          req instanceof Request ? new Request(req, init) : new Request(req.toString(), init);
        return dispatchChatRoute(routes, request);
      },
      subscribeToThread: runtime.subscribeToThread,
    });
    try {
      await client.getChannel("any");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ChatHttpClientError);
      const err = e as ChatHttpClientError;
      expect(err.status).toBe(401);
      expect(err.code).toBe(CHAT_ERROR_CODE.unauthorized);
    } finally {
      runtime.close();
    }
  });

  test("invalid request surfaces invalid_request code", async () => {
    const runtime = createChatHttpRuntime({
      persistence: createMemoryChatPersistence(),
    });
    const routes = createChatRoutesWithParams(runtime.service, TEST_TOKEN);
    const res = await dispatchChatRoute(
      routes,
      new Request(`http://boundary.test${CHAT_HTTP_PATH.channelsGet}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe(CHAT_ERROR_CODE.invalid_request);
    runtime.close();
  });
});
