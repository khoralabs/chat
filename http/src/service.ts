import type { ChatEvent, ChatPersistence, ChatService } from "@khoralabs/chat-core";
import { ChatNotFoundError, createChatService } from "@khoralabs/chat-core";
import {
  closeLocalSqliteDatabase,
  createLocalSqliteDatabase,
  createTursoChatPersistence,
  createTursoDatabase,
  ensureChatSchema,
} from "@khoralabs/chat-persistence-turso";

export type ChatHttpRuntime = {
  service: ChatService;
  subscribeToThread(threadId: string, send: (event: ChatEvent) => void): () => void;
  close(): void;
};

export type CreateChatHttpRuntimeOptions = {
  persistence: ChatPersistence;
  onEvent?: (event: ChatEvent) => void;
};

export type ChatStorageConfig =
  | { kind: "local-sqlite"; dbPath: string }
  | { kind: "turso"; url: string; authToken: string }
  | { kind: "custom"; persistence: ChatPersistence; close?: () => void };

export type ChatStorage = {
  persistence: ChatPersistence;
  close(): void;
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

/** Open host-selected storage and return persistence + cleanup. */
export async function createChatStorage(config: ChatStorageConfig): Promise<ChatStorage> {
  if (config.kind === "custom") {
    return {
      persistence: config.persistence,
      close() {
        config.close?.();
      },
    };
  }

  if (config.kind === "turso") {
    const db = createTursoDatabase({
      url: config.url,
      authToken: config.authToken,
    });
    await ensureChatSchema(db);
    return {
      persistence: createTursoChatPersistence(db),
      close() {
        closeLocalSqliteDatabase(db);
      },
    };
  }

  const db = createLocalSqliteDatabase(config.dbPath);
  return {
    persistence: createTursoChatPersistence(db),
    close() {
      closeLocalSqliteDatabase(db);
    },
  };
}

export function isChatNotFound(error: unknown): error is ChatNotFoundError {
  return error instanceof ChatNotFoundError;
}
