import type { ChatEvent, ChatPersistence, ChatService } from "@khoralabs/chat-core";
import { ChatNotFoundError, createChatService } from "@khoralabs/chat-core";
import {
  closeLocalSqliteDatabase,
  createLocalSqliteDatabase,
  createTursoChatPersistence,
  createTursoDatabase,
  ensureChatSchema,
  type SqlDatabase,
} from "@khoralabs/chat-persistence-turso";

import { resolveChatDbPath } from "./config.ts";

export type ChatHttpRuntime = {
  service: ChatService;
  subscribeToThread(threadId: string, send: (event: ChatEvent) => void): () => void;
  close(): void;
};

export type CreateChatHttpRuntimeOptions = {
  persistence: ChatPersistence;
  onEvent?: (event: ChatEvent) => void;
};

/** Build a ChatService + in-process thread event fanout from host-provided persistence. */
export function createChatHttpRuntime(options: CreateChatHttpRuntimeOptions): ChatHttpRuntime {
  const subscribers = new Map<string, Set<(event: ChatEvent) => void>>();

  const service = createChatService(options.persistence, {
    onEvent(event) {
      options.onEvent?.(event);
      if (!("threadId" in event)) return;
      for (const send of subscribers.get(event.threadId) ?? []) send(event);
    },
  });

  return {
    service,
    subscribeToThread(threadId, send) {
      const set = subscribers.get(threadId) ?? new Set<(event: ChatEvent) => void>();
      set.add(send);
      subscribers.set(threadId, set);
      return () => {
        set.delete(send);
        if (set.size === 0) subscribers.delete(threadId);
      };
    },
    close() {
      subscribers.clear();
    },
  };
}

let chatDbSingleton: SqlDatabase | undefined;
let runtimeSingleton: ChatHttpRuntime | undefined;
let chatStorageReady: Promise<void> | undefined;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} environment variable not set`);
  }
  return value;
}

function usesTursoBackend(): boolean {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  return url !== undefined && url.length > 0;
}

function createChatDatabase(): SqlDatabase {
  if (usesTursoBackend()) {
    return createTursoDatabase({
      url: requireEnv("TURSO_DATABASE_URL"),
      authToken: requireEnv("TURSO_AUTH_TOKEN"),
    });
  }
  return createLocalSqliteDatabase(resolveChatDbPath());
}

/** Env-based singleton for the runnable chat-http server. */
export async function initChatStorage(): Promise<void> {
  if (chatStorageReady !== undefined) {
    await chatStorageReady;
    return;
  }
  chatStorageReady = (async () => {
    if (chatDbSingleton === undefined) {
      chatDbSingleton = createChatDatabase();
      if (usesTursoBackend()) {
        await ensureChatSchema(chatDbSingleton);
      }
    }
    if (runtimeSingleton === undefined) {
      runtimeSingleton = createChatHttpRuntime({
        persistence: createTursoChatPersistence(chatDbSingleton),
      });
    }
  })();
  await chatStorageReady;
}

export function getChatDb(): SqlDatabase {
  if (chatDbSingleton === undefined) {
    chatDbSingleton = createChatDatabase();
  }
  return chatDbSingleton;
}

export function getChatService(): ChatService {
  if (runtimeSingleton === undefined) {
    runtimeSingleton = createChatHttpRuntime({
      persistence: createTursoChatPersistence(getChatDb()),
    });
  }
  return runtimeSingleton.service;
}

export function subscribeToChatThread(
  threadId: string,
  send: (event: ChatEvent) => void,
): () => void {
  if (runtimeSingleton === undefined) {
    getChatService();
  }
  const runtime = runtimeSingleton;
  if (runtime === undefined) {
    throw new Error("chat-http runtime failed to initialize");
  }
  return runtime.subscribeToThread(threadId, send);
}

export function closeChatDb(): void {
  if (chatDbSingleton !== undefined) {
    closeLocalSqliteDatabase(chatDbSingleton);
  }
  runtimeSingleton?.close();
  chatDbSingleton = undefined;
  runtimeSingleton = undefined;
  chatStorageReady = undefined;
}

export function isChatNotFound(error: unknown): error is ChatNotFoundError {
  return error instanceof ChatNotFoundError;
}
