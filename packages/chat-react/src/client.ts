import type { Post } from "@khoralabs/chat";
import { mergePostIntoList } from "@khoralabs/chat";
import {
  type PostToDisplayOptions,
  postsToDisplayMessages,
  postToDisplayMessage,
} from "./adapters.ts";

export type {
  AbortStreamedPostInput,
  AbortStreamedPostResult,
  AppendPostInput,
  ApplyPostDeltaInput,
  ApplyPostDeltaResult,
  Channel,
  ChatClient,
  ChatEvent,
  CompleteStreamedPostInput,
  ListPostsInput,
  ListThreadsInput,
  Post,
  PostPage,
  StartStreamedPostInput,
  StartStreamedPostResult,
  ThreadPage,
} from "@khoralabs/chat";

export { mergePostIntoList };

export function postToUiMessage(post: Post): Post {
  return post;
}

export function postsToUiMessages(posts: Post[]): Post[] {
  return posts;
}

export { type PostToDisplayOptions, postsToDisplayMessages, postToDisplayMessage };
