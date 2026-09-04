import type { UIMessage } from "ai";
import { ChatNotFoundError } from "../errors.ts";
import type { ChatEvent } from "../events.ts";
import type {
  AddThreadParticipantInput,
  AppendPostInput,
  CreateChannelInput,
  CreateThreadInput,
  ListPostsInput,
  ListThreadsInput,
  StartStreamedPostInput,
} from "../persistence/core/persistence/types.ts";
import type { ChatService } from "../service.ts";
import type { SignedEnvelope } from "../types.ts";
import {
  CHAT_HTTP_PATH,
  chatPostAbortPath,
  chatPostCompletePath,
  chatPostDeltasPath,
  chatThreadWsPath,
} from "./contracts/http.ts";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let message = `Chat request failed ${res.status}`;
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error !== undefined && data.error.length > 0) message = data.error;
    } catch {
      if (text.length > 0) message = text;
    }
    if (res.status === 404) {
      const match = /^(channel|thread|post) not found: (.+)$/i.exec(message);
      if (match?.[1] !== undefined && match[2] !== undefined) {
        throw new ChatNotFoundError(match[1].toLowerCase(), match[2]);
      }
    }
    throw new Error(message);
  }
  return (text.length > 0 ? JSON.parse(text) : {}) as T;
}

export type ChatFetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type ChatServiceClientOptions = {
  baseUrl: string;
  token: string;
  fetchFn?: ChatFetchFn;
  subscribeToThread?: (threadId: string, handler: (event: ChatEvent) => void) => () => void;
};

export type ChatServiceClient = Pick<
  ChatService,
  | "getChannel"
  | "createChannel"
  | "getThread"
  | "createThread"
  | "listPosts"
  | "listThreads"
  | "appendPost"
  | "getThreadTip"
  | "listThreadParticipants"
  | "addThreadParticipant"
  | "setPostVersionSignature"
  | "startStreamedPost"
  | "applyPostDelta"
  | "completeStreamedPost"
  | "abortStreamedPost"
> & {
  subscribeToThread(threadId: string, handler: (event: ChatEvent) => void): () => void;
};

export function createChatClient(options: ChatServiceClientOptions): ChatServiceClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchFn = options.fetchFn ?? fetch;

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchFn(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return readJson<T>(res);
  }

  return {
    getChannel(id) {
      return post(CHAT_HTTP_PATH.channelsGet, { channelId: id });
    },
    createChannel(input: CreateChannelInput) {
      return post(CHAT_HTTP_PATH.channelsCreate, input);
    },
    getThread(id) {
      return post(CHAT_HTTP_PATH.threadsGet, { threadId: id });
    },
    createThread(input: CreateThreadInput) {
      return post(CHAT_HTTP_PATH.threadsCreate, input);
    },
    listThreads(input: ListThreadsInput) {
      return post(CHAT_HTTP_PATH.threadsList, input);
    },
    listPosts(input: ListPostsInput) {
      return post(CHAT_HTTP_PATH.threadsListPosts, input);
    },
    async appendPost(input: AppendPostInput) {
      return post(CHAT_HTTP_PATH.threadsAppendPost, input);
    },
    async getThreadTip(threadId) {
      const result = await post<{ tip: Awaited<ReturnType<ChatService["getThreadTip"]>> }>(
        CHAT_HTTP_PATH.threadsTip,
        { threadId },
      );
      return result.tip;
    },
    async listThreadParticipants(threadId) {
      const result = await post<{
        participants: Awaited<ReturnType<ChatService["listThreadParticipants"]>>;
      }>(CHAT_HTTP_PATH.threadsListParticipants, { threadId });
      return result.participants;
    },
    addThreadParticipant(input: AddThreadParticipantInput) {
      return post(CHAT_HTTP_PATH.threadsAddParticipant, input);
    },
    async setPostVersionSignature(versionId: string, signature: SignedEnvelope) {
      await post(CHAT_HTTP_PATH.postsSetSignature, { versionId, signature });
    },
    startStreamedPost(input: StartStreamedPostInput) {
      return post(CHAT_HTTP_PATH.streamedPosts, input);
    },
    applyPostDelta(input) {
      return post(chatPostDeltasPath(input.postId), input);
    },
    completeStreamedPost(input) {
      return post(chatPostCompletePath(input.postId), input);
    },
    abortStreamedPost(input) {
      return post(chatPostAbortPath(input.postId), input);
    },
    subscribeToThread(threadId, handler) {
      if (options.subscribeToThread !== undefined) {
        return options.subscribeToThread(threadId, handler);
      }
      const wsUrl = `${baseUrl.replace(/^http/, "ws")}${chatThreadWsPath(threadId)}?token=${encodeURIComponent(options.token)}`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => handler(JSON.parse(String(event.data)) as ChatEvent);
      return () => ws.close();
    },
  };
}

export type StartStreamedPostBody = {
  author: StartStreamedPostInput["author"];
  message: UIMessage;
  threadId: string;
  idempotencyKey?: string;
};
