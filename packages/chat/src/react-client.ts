/**
 * Thin port for React / host UI layers.
 * Implementations may wrap {@link createChatClient} or a custom transport.
 */
import type { ChatEvent } from "./events.ts";
import type {
  AbortStreamedPostInput,
  AbortStreamedPostResult,
  AppendPostInput,
  ApplyPostDeltaInput,
  ApplyPostDeltaResult,
  CompleteStreamedPostInput,
  ListPostsInput,
  ListThreadsInput,
  StartStreamedPostInput,
  StartStreamedPostResult,
} from "./persistence/core/persistence/types.ts";
import type { Channel, Post, PostPage, ThreadPage } from "./types.ts";

export type ChatClient = {
  getChannel(id: string): Promise<Channel>;
  listThreads(input: ListThreadsInput): Promise<ThreadPage>;
  listPosts(input: ListPostsInput): Promise<PostPage>;
  appendPost(input: AppendPostInput): Promise<Post>;
  startStreamedPost?(input: StartStreamedPostInput): Promise<StartStreamedPostResult>;
  applyPostDelta?(input: ApplyPostDeltaInput): Promise<ApplyPostDeltaResult>;
  completeStreamedPost?(input: CompleteStreamedPostInput): Promise<Post>;
  abortStreamedPost?(input: AbortStreamedPostInput): Promise<AbortStreamedPostResult["post"]>;
  subscribeToThread?(threadId: string, handler: (event: ChatEvent) => void): () => void;
};

/** Upsert a post into a list sorted by `index` (stream / live updates). */
export function mergePostIntoList(posts: Post[], post: Post): Post[] {
  const index = posts.findIndex((item) => item.id === post.id);
  if (index === -1) {
    return [...posts, post].sort((a, b) => a.index - b.index);
  }
  const next = [...posts];
  next[index] = post;
  return next;
}
