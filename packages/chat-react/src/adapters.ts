import type { Post, ScopeRef } from "@khoralabs/chat";
import {
  type ChatDocumentWire,
  type ChatSourceWire,
  getMessageSources,
} from "@khoralabs/chat/sources";
import type { UIMessage } from "ai";
import type { ChatAuthor } from "./ui/author-avatar.tsx";

export type DisplayAttachment = {
  id: string;
  fileName: string;
  mediaType?: string;
  byteSize?: number;
  url?: string;
  /** Host-attached sourcemap citation (vs uploaded file). */
  kind?: "file" | "source";
  title?: string;
  sourceRef?: ChatSourceWire["sourceRef"];
};

/** Optional helper shape for hosts that want flattened tool calls. */
export type DisplayToolCall = {
  id: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state: "running" | "completed" | "error" | "awaiting-approval" | "denied";
  approval?: { id: string; approved?: boolean; reason?: string };
};

export type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  parts: UIMessage["parts"];
  createdAtMs: number;
  author: ChatAuthor | null;
  status?: Post["status"];
  attachments?: DisplayAttachment[];
  /** Set when metadata.displayText overrides rendered text parts. */
  displayText?: string;
};

export type PostToDisplayOptions = {
  resolveAuthor?: (author: ScopeRef) => ChatAuthor | null;
  resolveAttachmentUrl?: (attachment: DisplayAttachment) => string | undefined;
};

export function formatPostTimestamp(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function extractTextFromParts(parts: UIMessage["parts"]): string {
  return parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function extractToolCallsFromParts(parts: UIMessage["parts"]): DisplayToolCall[] {
  const toolCalls: DisplayToolCall[] = [];
  for (const part of parts) {
    if (typeof part.type !== "string" || !part.type.startsWith("tool-")) continue;
    const toolPart = part as {
      toolCallId?: string;
      state?: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
      approval?: { id: string; approved?: boolean; reason?: string };
    };
    const toolName = part.type.slice("tool-".length);
    toolCalls.push({
      id: toolPart.toolCallId ?? `${toolName}-${toolCalls.length}`,
      toolName,
      input: toolPart.input,
      output: toolPart.output,
      errorText: toolPart.errorText,
      state: toolStateForDisplay(toolPart.state),
      approval: toolPart.approval,
    });
  }
  return toolCalls;
}

export function hasRenderableParts(parts: UIMessage["parts"]): boolean {
  return parts.some(
    (part) =>
      part.type === "text" ||
      part.type === "reasoning" ||
      (typeof part.type === "string" && part.type.startsWith("tool-")),
  );
}

export function mapDocumentMetadata(document: ChatDocumentWire): DisplayAttachment {
  return {
    id: document.id,
    fileName: document.fileName,
    mediaType: document.mimeType ?? document.mediaType,
    byteSize: document.byteSize,
    kind: "file",
  };
}

export function mapSourceMetadata(source: ChatSourceWire): DisplayAttachment {
  return {
    id: source.id,
    fileName: source.title ?? source.id,
    title: source.title,
    mediaType: source.mediaType,
    kind: "source",
    sourceRef: source.sourceRef,
  };
}

export function guessAttachmentMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    case "json":
      return "application/json";
    case "mp4":
      return "video/mp4";
    case "mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

function defaultAuthor(author: ScopeRef): ChatAuthor {
  return { name: author.id };
}

function withResolvedUrl(
  attachment: DisplayAttachment,
  resolveUrl?: PostToDisplayOptions["resolveAttachmentUrl"],
): DisplayAttachment {
  return {
    ...attachment,
    url: resolveUrl?.(attachment) ?? attachment.url,
  };
}

export function postToDisplayMessage(
  post: Post,
  options: PostToDisplayOptions = {},
): DisplayMessage | null {
  if (post.role !== "user" && post.role !== "assistant") return null;

  const metadata = post.metadata as
    | {
        kickoff?: boolean;
        displayText?: string;
        documents?: ChatDocumentWire[];
      }
    | undefined;
  if (metadata?.kickoff === true) return null;

  const displayText = typeof metadata?.displayText === "string" ? metadata.displayText : undefined;

  const documentAttachments = (metadata?.documents ?? []).map((document) =>
    withResolvedUrl(mapDocumentMetadata(document), options.resolveAttachmentUrl),
  );
  const sourceAttachments = getMessageSources(post.metadata).map((source) =>
    withResolvedUrl(mapSourceMetadata(source), options.resolveAttachmentUrl),
  );
  const attachments =
    documentAttachments.length > 0 || sourceAttachments.length > 0
      ? [...documentAttachments, ...sourceAttachments]
      : undefined;

  if (
    post.status !== "streaming" &&
    !hasRenderableParts(post.parts) &&
    displayText === undefined &&
    (attachments?.length ?? 0) === 0
  ) {
    return null;
  }

  return {
    id: post.id,
    role: post.role,
    parts: post.parts,
    createdAtMs: post.createdAtMs,
    author: options.resolveAuthor?.(post.author) ?? defaultAuthor(post.author),
    status: post.status,
    attachments,
    displayText,
  };
}

export function postsToDisplayMessages(
  posts: Post[],
  options: PostToDisplayOptions = {},
): DisplayMessage[] {
  return posts
    .map((post) => postToDisplayMessage(post, options))
    .filter((message): message is DisplayMessage => message !== null);
}

export function toolStateForDisplay(state: string | undefined): DisplayToolCall["state"] {
  if (state === "output-available") return "completed";
  if (state === "output-error") return "error";
  if (state === "approval-requested") return "awaiting-approval";
  if (state === "output-denied") return "denied";
  return "running";
}
