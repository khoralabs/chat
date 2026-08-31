import type { UIMessage } from "ai";
import type {
  AppendPostInput,
  ChatSigner,
  JsonObject,
  Post,
  PostPage,
  PreparedAppendPost,
  ScopeRef,
  Thread,
  ThreadPage,
  ThreadTip,
} from "../domain.ts";
import { isChatNotFoundError } from "../errors.ts";
import {
  type ChatServiceClient,
  type ChatServiceClientOptions,
  createChatClient,
} from "../http/client.ts";
import { prepareAppendPost } from "../persistence/core/persistence/helpers.ts";
import { signPreparedAppendPost } from "../persistence/core/persistence/signed-persistence.ts";

import { createDidKeyChatCrypto, type ResolveDidKeyChatSigner } from "./chat-crypto.ts";

export type CreateAgentThreadInput = {
  id?: string;
  metadata?: JsonObject;
  /** Additional participants granted access when the thread is created. */
  participants?: Array<{ scope: ScopeRef; role?: string }>;
};

export type SendAgentMessageInput = {
  text: string;
  messageId?: string;
  role?: UIMessage["role"];
  /** Host-defined UIMessage.metadata (e.g. documents, sources). */
  metadata?: JsonObject;
};

export type AgentChatClient = {
  readonly did: string;
  createThread(input?: CreateAgentThreadInput): Promise<Thread>;
  grantAccess(threadId: string, participant: ScopeRef, role?: string): Promise<void>;
  sendMessage(threadId: string, input: SendAgentMessageInput): Promise<Post>;
  listPosts(threadId: string, input?: { limit?: number; cursor?: string }): Promise<PostPage>;
  listThreads(input?: { limit?: number; cursor?: string }): Promise<ThreadPage>;
  getThread(threadId: string): Promise<Thread>;
  listParticipants(threadId: string): Promise<ScopeRef[]>;
};

export type CreateSignedChatBackendOptions = {
  client: ChatServiceClient;
  resolveSigner: ResolveDidKeyChatSigner;
  /** Channel id for ensureChannel / createThread root / listThreads. */
  channelId: string;
  /** Metadata passed to createChannel when the channel is bootstrapped. */
  createChannelMetadata?: JsonObject;
};

export type SignedChatBackend = {
  readonly client: ChatServiceClient;
  readonly channelId: string;
  readonly ready: Promise<void>;
  forAgent(did: string): AgentChatClient;
  /** Chat client that authors as an arbitrary scope (agent, user, …). */
  forScope(scope: ScopeRef): AgentChatClient;
};

export type CreateRemoteSignedChatOptions = {
  baseUrl: string;
  token: string;
  resolveSigner: ResolveDidKeyChatSigner;
  fetchFn?: ChatServiceClientOptions["fetchFn"];
  channelId: string;
  createChannelMetadata?: JsonObject;
};

function agentScope(did: string): ScopeRef {
  return { type: "agent", id: did };
}

function textMessage(
  id: string,
  role: UIMessage["role"],
  text: string,
  metadata?: JsonObject,
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

export function prepareAppendForSigningFromTip(
  tip: ThreadTip | null,
  input: AppendPostInput,
): PreparedAppendPost {
  return prepareAppendPost({
    ...input,
    previousPostVersionId: tip?.id ?? null,
    previousLineageHash: tip?.lineageHash ?? null,
  });
}

async function ensureChannel(
  client: ChatServiceClient,
  channelId: string,
  createChannelMetadata?: JsonObject,
): Promise<void> {
  try {
    await client.getChannel(channelId);
  } catch (error) {
    if (!isChatNotFoundError(error)) throw error;
    await client.createChannel({
      id: channelId,
      metadata: createChannelMetadata,
    });
  }
}

export function createSignedChatBackend(
  options: CreateSignedChatBackendOptions,
): SignedChatBackend {
  const channelId = options.channelId.trim();
  if (channelId.length === 0) {
    throw new Error("createSignedChatBackend: channelId is required");
  }
  const chatCrypto = createDidKeyChatCrypto(options.resolveSigner);
  const ready = ensureChannel(options.client, channelId, options.createChannelMetadata);

  return {
    client: options.client,
    channelId,
    ready,
    forAgent(did: string) {
      return createScopedChatClient(
        options.client,
        agentScope(did),
        chatCrypto.signer,
        ready,
        channelId,
      );
    },
    forScope(scope: ScopeRef) {
      return createScopedChatClient(options.client, scope, chatCrypto.signer, ready, channelId);
    },
  };
}

/** Connect signed agent chat to a remote (or fetchFn-backed) chat-http service. */
export function createRemoteSignedChat(options: CreateRemoteSignedChatOptions): SignedChatBackend {
  const client = createChatClient({
    baseUrl: options.baseUrl,
    token: options.token,
    fetchFn: options.fetchFn,
  });
  return createSignedChatBackend({
    client,
    resolveSigner: options.resolveSigner,
    channelId: options.channelId,
    createChannelMetadata: options.createChannelMetadata,
  });
}

function createScopedChatClient(
  client: ChatServiceClient,
  scope: ScopeRef,
  chatSigner: ChatSigner,
  ready: Promise<void>,
  channelId: string,
): AgentChatClient {
  async function whenReady<T>(fn: () => Promise<T>): Promise<T> {
    await ready;
    return fn();
  }

  async function requireParticipant(threadId: string): Promise<void> {
    const participants = await client.listThreadParticipants(threadId);
    const allowed = participants.some((p) => p.type === scope.type && p.id === scope.id);
    if (!allowed) {
      throw new Error(`${scope.type} ${scope.id} does not have access to thread ${threadId}`);
    }
  }

  return {
    did: scope.id,
    createThread(input = {}) {
      return whenReady(async () => {
        const thread = await client.createThread({
          id: input.id ?? crypto.randomUUID(),
          root: { type: "channel", channelId },
          metadata: input.metadata,
        });

        await client.addThreadParticipant({
          threadId: thread.id,
          scope,
          role: "owner",
          actor: scope,
        });

        for (const participant of input.participants ?? []) {
          await client.addThreadParticipant({
            threadId: thread.id,
            scope: participant.scope,
            role: participant.role ?? "participant",
            actor: scope,
          });
        }

        return thread;
      });
    },
    grantAccess(threadId, participant, role = "participant") {
      return whenReady(async () => {
        await requireParticipant(threadId);
        await client.addThreadParticipant({
          threadId,
          scope: participant,
          role,
          actor: scope,
        });
      });
    },
    sendMessage(threadId, input) {
      return whenReady(async () => {
        await requireParticipant(threadId);

        const message = textMessage(
          input.messageId ?? crypto.randomUUID(),
          input.role ?? "user",
          input.text,
          input.metadata,
        );
        const appendInput = { threadId, author: scope, message };
        const tip = await client.getThreadTip(threadId);
        const prepared = prepareAppendForSigningFromTip(tip, appendInput);
        const signature = await signPreparedAppendPost(chatSigner, scope, prepared);

        const { post } = await client.appendPost({
          ...appendInput,
          message: prepared.message,
          versionId: prepared.versionId,
          createdAtMs: prepared.createdAtMs,
          signature,
        });
        return post;
      });
    },
    listPosts(threadId, input) {
      return whenReady(async () => {
        await requireParticipant(threadId);
        return client.listPosts({
          threadId,
          limit: input?.limit,
          cursor: input?.cursor,
        });
      });
    },
    listThreads(input) {
      return whenReady(() =>
        client.listThreads({
          channelId,
          participant: scope,
          limit: input?.limit,
          cursor: input?.cursor,
        }),
      );
    },
    getThread(threadId) {
      return whenReady(async () => {
        await requireParticipant(threadId);
        return client.getThread(threadId);
      });
    },
    listParticipants(threadId) {
      return whenReady(async () => {
        await requireParticipant(threadId);
        return client.listThreadParticipants(threadId);
      });
    },
  };
}
