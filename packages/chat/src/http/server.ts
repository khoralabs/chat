import { type ServerWebSocket, serve } from "bun";
import type { ChatEvent } from "../domain.ts";
import type { ChatService } from "../service.ts";

import { chatHttpPort, chatInternalToken, resolveChatDbPath } from "./config.ts";
import { createChatRoutesWithParams, dispatchChatRoute, requireInternalToken } from "./routes.ts";
import { type ChatStorageConfig, createChatHttpRuntime, createChatStorage } from "./service.ts";

export type ChatHttpServerHandle = {
  port: number;
  baseUrl: string;
  token: string;
  service: ChatService;
  stop(): void;
};

export type StartChatHttpServerOptions = {
  storage: ChatStorageConfig;
  token: string;
  port?: number;
  onEvent?: (event: ChatEvent) => void;
};

type WsData = {
  threadId: string;
  unsubscribe?: () => void;
};

/** Start chat HTTP (routes + /health + thread WebSocket fanout) with host-provided storage. */
export async function startChatHttpServer(
  opts: StartChatHttpServerOptions,
): Promise<ChatHttpServerHandle> {
  const storage = await createChatStorage(opts.storage);
  const runtime = createChatHttpRuntime({
    persistence: storage.persistence,
    onEvent: opts.onEvent,
  });
  const routes = createChatRoutesWithParams(runtime.service, opts.token);
  const token = opts.token;

  const server = serve<WsData>({
    port: opts.port ?? 0,
    fetch(req, bunServer) {
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/health") {
        return Response.json({ ok: true });
      }
      if (url.pathname.startsWith("/ws/threads/")) {
        const authError = requireInternalToken(req, token);
        if (authError !== null) return authError;
        const threadId = decodeURIComponent(url.pathname.slice("/ws/threads/".length));
        if (threadId.length === 0) {
          return Response.json({ error: "threadId is required" }, { status: 400 });
        }
        const upgraded = bunServer.upgrade(req, { data: { threadId } satisfies WsData });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return dispatchChatRoute(routes, req);
    },
    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        ws.data.unsubscribe = runtime.subscribeToThread(ws.data.threadId, (event) => {
          ws.send(JSON.stringify(event));
        });
      },
      message() {},
      close(ws: ServerWebSocket<WsData>) {
        ws.data.unsubscribe?.();
      },
    },
  });

  const port = server.port ?? opts.port ?? 0;
  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    token,
    service: runtime.service,
    stop() {
      server.stop(true);
      runtime.close();
      storage.close();
    },
  };
}

function storageConfigFromEnv(): ChatStorageConfig {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl !== undefined && tursoUrl.length > 0) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (authToken === undefined || authToken.length === 0) {
      throw new Error("TURSO_AUTH_TOKEN must be set when TURSO_DATABASE_URL is set");
    }
    return { kind: "turso", url: tursoUrl, authToken };
  }
  return { kind: "local-sqlite", dbPath: resolveChatDbPath() };
}

if (import.meta.main) {
  const handle = await startChatHttpServer({
    storage: storageConfigFromEnv(),
    token: chatInternalToken(),
    port: chatHttpPort(),
  });
  console.log(`chat-http listening on ${handle.port}`);
}
