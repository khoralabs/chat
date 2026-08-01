"use client";

import type { ChatStatus, ToolUIPart, UIMessage } from "ai";
import { CheckIcon, XIcon } from "lucide-react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { DisplayMessage } from "../adapters.ts";
import { formatPostTimestamp } from "../adapters.ts";
import { showAgentLoading } from "../hooks/use-agent-loading.ts";
import { Attachment, AttachmentPreview } from "./ai-elements/attachments.tsx";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
} from "./ai-elements/confirmation.tsx";
import {
  Conversation,
  ConversationContent,
  ConversationItem,
  ConversationProvider,
  ConversationScrollButton,
  useConversationProviderScope,
} from "./ai-elements/conversation.tsx";
import {
  Message,
  MessageContent,
  MessageHeader,
  MessageResponse,
  MessageTimestamp,
} from "./ai-elements/message.tsx";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./ai-elements/reasoning.tsx";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./ai-elements/tool.tsx";
import { MessageAttachments } from "./attachments-bridge.tsx";
import type { ChatAuthor } from "./author-avatar.tsx";
import { chatColumnClassName } from "./layout.ts";

export type ToolApprovalResponse = {
  messageId: string;
  toolCallId: string;
  approvalId: string;
  approved: boolean;
};

type PostMessagesContextValue = {
  messages: DisplayMessage[];
  status: ChatStatus;
  showAgentLoading: boolean;
  loadingAuthor: ChatAuthor | null;
  onToolApprovalResponse?: (response: ToolApprovalResponse) => void;
};

const PostMessagesContext = createContext<PostMessagesContextValue | null>(null);

function usePostMessagesContext() {
  const context = useContext(PostMessagesContext);
  if (!context) {
    throw new Error("PostMessages compound components must be used within PostMessages");
  }
  return context;
}

type PostMessageContextValue = {
  message: DisplayMessage;
};

const PostMessageContext = createContext<PostMessageContextValue | null>(null);

function usePostMessageContext() {
  const context = useContext(PostMessageContext);
  if (!context) {
    throw new Error("PostMessage compound components must be used within PostMessage");
  }
  return context;
}

function PostMessagesShell({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <Conversation className={className ?? "flex-1"}>
      <ConversationContent className={chatColumnClassName}>{children}</ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

export function PostMessages({
  messages,
  status,
  awaitingOpening = false,
  showAgentLoading: showAgentLoadingProp,
  loadingAuthor = null,
  onToolApprovalResponse,
  className,
  withProvider = true,
  children,
}: {
  messages: DisplayMessage[];
  status: ChatStatus;
  awaitingOpening?: boolean;
  showAgentLoading?: boolean;
  loadingAuthor?: ChatAuthor | null;
  onToolApprovalResponse?: (response: ToolApprovalResponse) => void;
  className?: string;
  withProvider?: boolean;
  children?: ReactNode;
}) {
  const showLoading = showAgentLoadingProp ?? showAgentLoading(awaitingOpening, messages, status);
  const value = useMemo(
    () => ({
      messages,
      status,
      showAgentLoading: showLoading,
      loadingAuthor,
      onToolApprovalResponse,
    }),
    [messages, status, showLoading, loadingAuthor, onToolApprovalResponse],
  );
  const inProviderScope = useConversationProviderScope();
  const shouldProvide = withProvider && !inProviderScope;

  const body = (
    <PostMessagesContext.Provider value={value}>
      <PostMessagesShell className={className}>
        {children ?? (
          <>
            {messages.map((message) => (
              <PostMessage key={message.id} message={message} />
            ))}
            <PostMessagesLoading />
          </>
        )}
      </PostMessagesShell>
    </PostMessagesContext.Provider>
  );

  if (!shouldProvide) return body;
  return <ConversationProvider>{body}</ConversationProvider>;
}

export function PostMessage({
  message,
  children,
}: {
  message: DisplayMessage;
  children?: ReactNode;
}) {
  const value = useMemo(() => ({ message }), [message]);

  return (
    <PostMessageContext.Provider value={value}>
      <ConversationItem messageId={message.id} scrollAnchor={message.role === "user"}>
        <Message data-post-id={message.id} data-message-id={message.id} from={message.role}>
          {children ?? (
            <>
              <PostMessageHeader />
              <PostMessageAttachments />
              <PostMessageContent />
              <PostMessageTimestamp />
            </>
          )}
        </Message>
      </ConversationItem>
    </PostMessageContext.Provider>
  );
}

export function PostMessageHeader({ children }: { children?: ReactNode }) {
  const { message } = usePostMessageContext();
  if (children !== undefined) return <>{children}</>;
  return (
    <MessageHeader
      author={message.author}
      from={message.role}
      shimmer={message.role === "assistant" && message.status === "streaming"}
    />
  );
}

export function PostMessageAttachments({ children }: { children?: ReactNode }) {
  const { message } = usePostMessageContext();
  if (children !== undefined) return <>{children}</>;
  if (message.role !== "user" || (message.attachments?.length ?? 0) === 0) return null;
  return (
    <MessageAttachments attachments={message.attachments ?? []}>
      {(attachment) => (
        <a
          className="block shrink-0 rounded-lg"
          data-attachment-id={attachment.id}
          href={attachment.type === "file" ? attachment.url : undefined}
          rel="noreferrer"
          target="_blank"
        >
          <Attachment data={attachment}>
            <AttachmentPreview />
          </Attachment>
        </a>
      )}
    </MessageAttachments>
  );
}

function isToolPart(part: UIMessage["parts"][number]): part is ToolUIPart {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

function DefaultToolPart({ part, messageId }: { part: ToolUIPart; messageId: string }) {
  const { onToolApprovalResponse } = usePostMessagesContext();
  const toolName = part.type.slice("tool-".length);
  const toolCallId = part.toolCallId;
  const approval = part.approval;

  return (
    <>
      <Tool defaultOpen={part.state !== "output-available" && part.state !== "output-error"}>
        <ToolHeader state={part.state} title={toolName} type={part.type} />
        <ToolContent>
          {part.input !== undefined ? <ToolInput input={part.input} /> : null}
          <ToolOutput errorText={part.errorText} output={part.output} />
        </ToolContent>
      </Tool>
      {approval ? (
        <Confirmation approval={approval} state={part.state}>
          <ConfirmationRequest>
            Approve running <code>{toolName}</code>?
          </ConfirmationRequest>
          <ConfirmationAccepted>
            <CheckIcon className="size-4" />
            <span>Approved</span>
          </ConfirmationAccepted>
          <ConfirmationRejected>
            <XIcon className="size-4" />
            <span>Rejected</span>
          </ConfirmationRejected>
          <ConfirmationActions>
            <ConfirmationAction
              onClick={() =>
                onToolApprovalResponse?.({
                  messageId,
                  toolCallId,
                  approvalId: approval.id,
                  approved: false,
                })
              }
              variant="outline"
            >
              Reject
            </ConfirmationAction>
            <ConfirmationAction
              onClick={() =>
                onToolApprovalResponse?.({
                  messageId,
                  toolCallId,
                  approvalId: approval.id,
                  approved: true,
                })
              }
              variant="default"
            >
              Approve
            </ConfirmationAction>
          </ConfirmationActions>
        </Confirmation>
      ) : null}
    </>
  );
}

function MessageParts({ message }: { message: DisplayMessage }) {
  const nodes: ReactNode[] = [];
  const parts = message.parts;
  let i = 0;
  let renderedDisplayText = false;

  while (i < parts.length) {
    const part = parts[i];
    if (!part) break;

    if (part.type === "reasoning") {
      let text = part.text;
      let streaming = part.state === "streaming";
      let j = i + 1;
      while (j < parts.length && parts[j]?.type === "reasoning") {
        const next = parts[j] as Extract<UIMessage["parts"][number], { type: "reasoning" }>;
        text += `\n\n${next.text}`;
        streaming = streaming || next.state === "streaming";
        j += 1;
      }
      const isStreaming = message.status === "streaming" && streaming;
      nodes.push(
        <Reasoning isStreaming={isStreaming} key={`reasoning-${i}`}>
          <ReasoningTrigger />
          <ReasoningContent>{text}</ReasoningContent>
        </Reasoning>,
      );
      i = j;
      continue;
    }

    if (part.type === "text") {
      if (message.displayText !== undefined) {
        if (!renderedDisplayText) {
          nodes.push(<MessageResponse key="display-text">{message.displayText}</MessageResponse>);
          renderedDisplayText = true;
        }
        i += 1;
        continue;
      }
      nodes.push(<MessageResponse key={`text-${i}`}>{part.text}</MessageResponse>);
      i += 1;
      continue;
    }

    if (isToolPart(part)) {
      nodes.push(
        <DefaultToolPart key={`tool-${part.toolCallId ?? i}`} messageId={message.id} part={part} />,
      );
      i += 1;
      continue;
    }

    i += 1;
  }

  if (message.displayText !== undefined && !renderedDisplayText) {
    nodes.push(<MessageResponse key="display-text">{message.displayText}</MessageResponse>);
  }

  return nodes;
}

/** Renders tool-* parts from the message (override via children). */
export function PostMessageTools({ children }: { children?: ReactNode }) {
  const { message } = usePostMessageContext();
  const toolParts = message.parts.filter(isToolPart);
  if (toolParts.length === 0) return null;
  if (children !== undefined) return <>{children}</>;
  return (
    <>
      {toolParts.map((part, index) => (
        <DefaultToolPart
          key={part.toolCallId ?? `tool-${index}`}
          messageId={message.id}
          part={part}
        />
      ))}
    </>
  );
}

export function PostMessageContent({ children }: { children?: ReactNode }) {
  const { message } = usePostMessageContext();
  if (children !== undefined) return <MessageContent>{children}</MessageContent>;
  return (
    <MessageContent>
      <MessageParts message={message} />
    </MessageContent>
  );
}

export function PostMessageTimestamp({ children }: { children?: ReactNode }) {
  const { message } = usePostMessageContext();
  if (children !== undefined) return <>{children}</>;
  return <MessageTimestamp from={message.role} label={formatPostTimestamp(message.createdAtMs)} />;
}

export function PostMessagesEmpty({
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  const { messages } = usePostMessagesContext();
  if (messages.length > 0) return null;
  if (children !== undefined) return <>{children}</>;
  return (
    <ConversationItem messageId="__empty" scrollAnchor={false}>
      <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </ConversationItem>
  );
}

export function PostMessagesLoading({ children }: { children?: ReactNode }) {
  const { showAgentLoading, loadingAuthor } = usePostMessagesContext();
  if (!showAgentLoading) return null;
  if (children !== undefined) return <>{children}</>;
  return (
    <ConversationItem messageId="__agent-loading" scrollAnchor={false}>
      <Message data-agent-loading from="assistant">
        <MessageHeader author={loadingAuthor} from="assistant" shimmer />
      </Message>
    </ConversationItem>
  );
}

export { usePostMessageContext, usePostMessagesContext };
