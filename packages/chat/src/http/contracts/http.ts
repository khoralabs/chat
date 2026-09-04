/** HTTP path constants shared by chat client, routes, and server. */

/** Protocol version returned by `GET /health`. */
export const CHAT_PROTOCOL_VERSION = 1 as const;

export type ChatHealthResponse = {
  ok: true;
  version: typeof CHAT_PROTOCOL_VERSION;
};

export const CHAT_HTTP_PATH = {
  health: "/health",
  channelsGet: "/channels/get",
  channelsCreate: "/channels/create",
  threadsGet: "/threads/get",
  threadsCreate: "/threads/create",
  threadsList: "/threads/list",
  threadsListPosts: "/threads/list-posts",
  threadsTip: "/threads/tip",
  threadsListParticipants: "/threads/list-participants",
  threadsAddParticipant: "/threads/add-participant",
  threadsAppendPost: "/threads/append-post",
  postsSetSignature: "/posts/set-signature",
  streamedPosts: "/internal/chat/streamed-posts",
  threadStreamedPostsTemplate: "/internal/chat/threads/:threadId/streamed-posts",
  postDeltasTemplate: "/internal/chat/posts/:postId/deltas",
  postCompleteTemplate: "/internal/chat/posts/:postId/complete",
  postAbortTemplate: "/internal/chat/posts/:postId/abort",
  threadsWsPrefix: "/ws/threads/",
} as const;

export type ChatHttpPathKey = keyof typeof CHAT_HTTP_PATH;

export function chatPostDeltasPath(postId: string): string {
  return `/internal/chat/posts/${encodeURIComponent(postId)}/deltas`;
}

export function chatPostCompletePath(postId: string): string {
  return `/internal/chat/posts/${encodeURIComponent(postId)}/complete`;
}

export function chatPostAbortPath(postId: string): string {
  return `/internal/chat/posts/${encodeURIComponent(postId)}/abort`;
}

export function chatThreadWsPath(threadId: string): string {
  return `${CHAT_HTTP_PATH.threadsWsPrefix}${encodeURIComponent(threadId)}`;
}

export function chatThreadStreamedPostsPath(threadId: string): string {
  return `/internal/chat/threads/${encodeURIComponent(threadId)}/streamed-posts`;
}

export function chatRouteKey(method: string, path: string): string {
  return `${method} ${path}`;
}
