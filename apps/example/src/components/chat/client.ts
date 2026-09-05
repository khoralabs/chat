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
export { mergePostIntoList } from "@khoralabs/chat";
export {
  type PostToDisplayOptions,
  postsToDisplayMessages,
  postToDisplayMessage,
} from "./adapters.ts";

export function postToUiMessage<T>(post: T): T {
  return post;
}

export function postsToUiMessages<T>(posts: T[]): T[] {
  return posts;
}
