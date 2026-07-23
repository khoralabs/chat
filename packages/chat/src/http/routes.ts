import type { UIMessage } from "ai";
import type { PostModelMetadata, PostUsage, ScopeRef, SignedEnvelope } from "../domain.ts";
import { isChatNotFoundError } from "../errors.ts";
import type { ChatService } from "../service.ts";

function json(value: unknown, init?: ResponseInit): Response {
  return Response.json(value, init);
}

function extractBearerToken(req: Request): string {
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  const headerToken = match?.[1]?.trim() ?? "";
  if (headerToken.length > 0) return headerToken;
  const url = new URL(req.url);
  return url.searchParams.get("token")?.trim() ?? "";
}

export type AuthorizeRequest = (req: Request) => Response | null | Promise<Response | null>;

export function requireInternalToken(req: Request, expected: string): Response | null {
  const token = extractBearerToken(req);
  if (token.length === 0 || token !== expected) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function createTokenAuthorizer(token: string): AuthorizeRequest {
  return (req) => requireInternalToken(req, token);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

function stringField(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function errorResponse(error: unknown): Response {
  if (isChatNotFoundError(error)) {
    return json({ error: error.message }, { status: 404 });
  }
  const message = error instanceof Error ? error.message : String(error);
  return json({ error: message }, { status: 500 });
}

export type RouteHandler = (req: Request) => Response | Promise<Response>;

export type CreateChatRoutesOptions = {
  /** Default: shared-secret Bearer via `token`. */
  authorize?: AuthorizeRequest;
  token?: string;
};

function resolveAuthorize(options: CreateChatRoutesOptions): AuthorizeRequest {
  if (options.authorize !== undefined) return options.authorize;
  if (options.token !== undefined && options.token.length > 0) {
    return createTokenAuthorizer(options.token);
  }
  throw new Error("createChatRoutes requires token or authorize");
}

export function createChatRoutes(
  chat: ChatService,
  tokenOrOptions: string | CreateChatRoutesOptions,
): Record<string, RouteHandler> {
  const options: CreateChatRoutesOptions =
    typeof tokenOrOptions === "string" ? { token: tokenOrOptions } : tokenOrOptions;
  const authorized = resolveAuthorize(options);

  return {
    "GET /health": async () => json({ ok: true }),

    "POST /channels/get": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<Record<string, unknown>>(req);
      const channelId = body === null ? null : stringField(body, "channelId");
      if (channelId === null) return json({ error: "channelId is required" }, { status: 400 });
      try {
        return json(await chat.getChannel(channelId));
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /channels/create": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<Record<string, unknown>>(req);
      const id = body === null ? null : stringField(body, "id");
      if (id === null) return json({ error: "id is required" }, { status: 400 });
      try {
        return json(
          await chat.createChannel({
            id,
            metadata: body?.metadata as Record<string, unknown> | undefined,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/get": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<Record<string, unknown>>(req);
      const threadId = body === null ? null : stringField(body, "threadId");
      if (threadId === null) return json({ error: "threadId is required" }, { status: 400 });
      try {
        return json(await chat.getThread(threadId));
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/create": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<{
        id?: string;
        root?: { type: "channel"; channelId: string };
        metadata?: Record<string, unknown>;
      }>(req);
      if (body?.id === undefined || body.root === undefined) {
        return json({ error: "id and root are required" }, { status: 400 });
      }
      try {
        return json(
          await chat.createThread({
            id: body.id,
            root: body.root,
            metadata: body.metadata,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/list": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<{
        channelId?: string;
        participant?: ScopeRef;
        limit?: number;
        cursor?: string;
      }>(req);
      if (body?.channelId === undefined) {
        return json({ error: "channelId is required" }, { status: 400 });
      }
      try {
        return json(
          await chat.listThreads({
            channelId: body.channelId,
            participant: body.participant,
            limit: body.limit,
            cursor: body.cursor,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/list-posts": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<{ threadId?: string; limit?: number; cursor?: string }>(req);
      if (body?.threadId === undefined) {
        return json({ error: "threadId is required" }, { status: 400 });
      }
      try {
        return json(
          await chat.listPosts({ threadId: body.threadId, limit: body.limit, cursor: body.cursor }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/tip": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<Record<string, unknown>>(req);
      const threadId = body === null ? null : stringField(body, "threadId");
      if (threadId === null) return json({ error: "threadId is required" }, { status: 400 });
      try {
        return json({ tip: await chat.getThreadTip(threadId) });
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/list-participants": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<Record<string, unknown>>(req);
      const threadId = body === null ? null : stringField(body, "threadId");
      if (threadId === null) return json({ error: "threadId is required" }, { status: 400 });
      try {
        return json({ participants: await chat.listThreadParticipants(threadId) });
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/add-participant": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<{
        threadId?: string;
        scope?: ScopeRef;
        role?: string;
        actor?: ScopeRef;
      }>(req);
      if (body?.threadId === undefined || body.scope === undefined || body.actor === undefined) {
        return json({ error: "threadId, scope, and actor are required" }, { status: 400 });
      }
      try {
        return json(
          await chat.addThreadParticipant({
            threadId: body.threadId,
            scope: body.scope,
            role: body.role ?? "participant",
            actor: body.actor,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /threads/append-post": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<{
        threadId?: string;
        author?: ScopeRef;
        message?: UIMessage;
        expectedHeadPostVersionId?: string | null;
        versionId?: string;
        createdAtMs?: number;
        signature?: SignedEnvelope;
      }>(req);
      if (body?.threadId === undefined || body.author === undefined || body.message === undefined) {
        return json({ error: "threadId, author, and message are required" }, { status: 400 });
      }
      try {
        return json(
          await chat.appendPost({
            threadId: body.threadId,
            author: body.author,
            message: body.message,
            expectedHeadPostVersionId: body.expectedHeadPostVersionId,
            versionId: body.versionId,
            createdAtMs: body.createdAtMs,
            signature: body.signature,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /posts/set-signature": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<{ versionId?: string; signature?: SignedEnvelope }>(req);
      if (body?.versionId === undefined || body.signature === undefined) {
        return json({ error: "versionId and signature are required" }, { status: 400 });
      }
      try {
        await chat.setPostVersionSignature(body.versionId, body.signature);
        return json({ ok: true });
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /internal/chat/streamed-posts": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const body = await readJson<{
        author?: ScopeRef;
        idempotencyKey?: string;
        message?: UIMessage;
        threadId?: string;
      }>(req);
      if (body?.author === undefined || body.message === undefined || body.threadId === undefined) {
        return json({ error: "threadId, author, and message are required" }, { status: 400 });
      }
      try {
        return json(
          await chat.startStreamedPost({
            threadId: body.threadId,
            author: body.author,
            idempotencyKey: body.idempotencyKey,
            message: body.message,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /internal/chat/posts/:postId/deltas": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const url = new URL(req.url);
      const postId = url.pathname.split("/").at(-2);
      if (postId === undefined) return json({ error: "postId is required" }, { status: 400 });
      const body = await readJson<ApplyPostDeltaBody>(req);
      if (body?.message === undefined) {
        return json({ error: "message is required" }, { status: 400 });
      }
      try {
        return json(
          await chat.applyPostDelta({
            postId,
            expectedRevision: body.expectedRevision,
            message: body.message,
            model: body.model,
            usage: body.usage,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /internal/chat/posts/:postId/complete": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const url = new URL(req.url);
      const postId = url.pathname.split("/").at(-2);
      if (postId === undefined) return json({ error: "postId is required" }, { status: 400 });
      const body = await readJson<CompleteStreamedPostBody>(req);
      try {
        return json(
          await chat.completeStreamedPost({
            postId,
            expectedRevision: body?.expectedRevision,
            idempotencyKey: body?.idempotencyKey,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },

    "POST /internal/chat/posts/:postId/abort": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const url = new URL(req.url);
      const postId = url.pathname.split("/").at(-2);
      if (postId === undefined) return json({ error: "postId is required" }, { status: 400 });
      try {
        const post = await chat.abortStreamedPost({ postId });
        return json({ post });
      } catch (err) {
        return errorResponse(err);
      }
    },
  };
}

type ApplyPostDeltaBody = {
  expectedRevision?: number;
  message?: UIMessage;
  model?: PostModelMetadata;
  usage?: PostUsage;
};

type CompleteStreamedPostBody = {
  expectedRevision?: number;
  idempotencyKey?: string;
};

export function createChatRoutesWithParams(
  chat: ChatService,
  tokenOrOptions: string | CreateChatRoutesOptions,
): Record<string, RouteHandler> {
  const options: CreateChatRoutesOptions =
    typeof tokenOrOptions === "string" ? { token: tokenOrOptions } : tokenOrOptions;
  const base = createChatRoutes(chat, options);
  const authorized = resolveAuthorize(options);

  return {
    ...base,
    "POST /internal/chat/threads/:threadId/streamed-posts": async (req) => {
      const error = await authorized(req);
      if (error !== null) return error;
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const threadIdx = parts.indexOf("threads");
      const threadId = threadIdx >= 0 ? decodeURIComponent(parts[threadIdx + 1] ?? "") : undefined;
      const body = await readJson<{
        author?: ScopeRef;
        idempotencyKey?: string;
        message?: UIMessage;
      }>(req);
      if (
        threadId === undefined ||
        threadId.length === 0 ||
        body?.author === undefined ||
        body.message === undefined
      ) {
        return json({ error: "threadId, author, and message are required" }, { status: 400 });
      }
      try {
        return json(
          await chat.startStreamedPost({
            threadId,
            author: body.author,
            idempotencyKey: body.idempotencyKey,
            message: body.message,
          }),
        );
      } catch (err) {
        return errorResponse(err);
      }
    },
  };
}

export async function dispatchChatRoute(
  routes: Record<string, RouteHandler>,
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);

  const paramPaths = [
    "POST /internal/chat/threads/:threadId/streamed-posts",
    "POST /internal/chat/posts/:postId/deltas",
    "POST /internal/chat/posts/:postId/complete",
    "POST /internal/chat/posts/:postId/abort",
  ];

  for (const pattern of paramPaths) {
    const [method, pathPattern] = pattern.split(" ");
    if (req.method !== method || pathPattern === undefined) continue;
    const regex = new RegExp(`^${pathPattern.replace(/:[^/]+/g, "[^/]+")}$`);
    if (regex.test(url.pathname)) {
      const handler = routes[pattern];
      if (handler !== undefined) return handler(req);
    }
  }

  const key = `${req.method} ${url.pathname}`;
  const handler = routes[key];
  if (handler === undefined) return json({ error: "Not found" }, { status: 404 });
  return handler(req);
}
