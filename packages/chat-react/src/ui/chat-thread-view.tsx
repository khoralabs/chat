"use client";

import type { ChatStatus } from "ai";
import type { ReactNode, RefObject } from "react";
import { cn } from "#lib/utils";
import type { DisplayMessage } from "../adapters.ts";
import { showAgentLoading } from "../hooks/use-agent-loading.ts";
import { type ScrollTarget, useScrollToPost } from "../hooks/use-scroll-to-post.ts";
import { ConversationProvider } from "./ai-elements/conversation.tsx";
import type { ChatAuthor } from "./author-avatar.tsx";
import { ChatDropOverlay } from "./drop-overlay.tsx";
import { PostMessages, type ToolApprovalResponse } from "./post-messages.tsx";
import { PromptComposer, type PromptInputMessage } from "./prompt-composer.tsx";

export type { ToolApprovalResponse };

function ChatThreadScrollTarget({
  scrollTarget,
  onScrollTargetComplete,
}: {
  scrollTarget?: ScrollTarget | null;
  onScrollTargetComplete?: () => void;
}) {
  useScrollToPost(scrollTarget, onScrollTargetComplete, true);
  return null;
}

export function ChatThreadView({
  messages,
  status,
  connected,
  chatError,
  input,
  agentAuthor,
  awaitingOpening = false,
  showAgentLoading: showAgentLoadingProp,
  canWrite,
  readOnlyMessage = "Read-only access",
  placeholder,
  chatRootRef,
  isDragActive = false,
  scrollTarget,
  onScrollTargetComplete,
  onAttachmentControlsReady,
  onSubmit,
  onStop,
  onTextChange,
  onError,
  onToolApprovalResponse,
  composerHeader,
  messagesChildren,
  composerChildren,
}: {
  messages: DisplayMessage[];
  status: ChatStatus;
  connected: boolean;
  chatError: string | null;
  input: string;
  agentAuthor: ChatAuthor | null;
  awaitingOpening?: boolean;
  showAgentLoading?: boolean;
  canWrite: boolean;
  readOnlyMessage?: string;
  placeholder: string;
  chatRootRef?: RefObject<HTMLDivElement | null>;
  isDragActive?: boolean;
  scrollTarget?: ScrollTarget | null;
  onScrollTargetComplete?: () => void;
  onAttachmentControlsReady: (controls: {
    add: (files: File[] | FileList) => void;
    clear: () => void;
  }) => void;
  onSubmit: (message: PromptInputMessage) => void;
  onStop: () => void;
  onTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onError: (error: string) => void;
  onToolApprovalResponse?: (response: ToolApprovalResponse) => void;
  composerHeader?: ReactNode;
  messagesChildren?: ReactNode;
  composerChildren?: ReactNode;
}) {
  const agentLoading = showAgentLoadingProp ?? showAgentLoading(awaitingOpening, messages, status);

  return (
    <ConversationProvider>
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          isDragActive && "select-none",
        )}
        ref={chatRootRef}
      >
        <ChatThreadScrollTarget
          onScrollTargetComplete={onScrollTargetComplete}
          scrollTarget={scrollTarget}
        />
        <ChatThreadDropOverlay active={isDragActive} />
        <ChatThreadMessages
          agentAuthor={agentAuthor}
          awaitingOpening={awaitingOpening}
          messages={messages}
          onToolApprovalResponse={onToolApprovalResponse}
          showAgentLoading={agentLoading}
          status={status}
        >
          {messagesChildren}
        </ChatThreadMessages>
        {canWrite ? (
          <ChatThreadComposer
            chatError={chatError}
            connected={connected}
            input={input}
            onAttachmentControlsReady={onAttachmentControlsReady}
            onError={onError}
            onStop={onStop}
            onSubmit={onSubmit}
            onTextChange={onTextChange}
            placeholder={placeholder}
            status={status}
            header={composerHeader}
          >
            {composerChildren}
          </ChatThreadComposer>
        ) : (
          <ChatThreadReadOnly message={readOnlyMessage} />
        )}
      </div>
    </ConversationProvider>
  );
}

export function ChatThreadDropOverlay({ active }: { active: boolean }) {
  return <ChatDropOverlay active={active} />;
}

export function ChatThreadMessages({
  messages,
  status,
  awaitingOpening = false,
  showAgentLoading,
  agentAuthor,
  onToolApprovalResponse,
  children,
}: {
  messages: DisplayMessage[];
  status: ChatStatus;
  awaitingOpening?: boolean;
  showAgentLoading?: boolean;
  agentAuthor: ChatAuthor | null;
  onToolApprovalResponse?: (response: ToolApprovalResponse) => void;
  children?: ReactNode;
}) {
  return (
    <PostMessages
      awaitingOpening={awaitingOpening}
      loadingAuthor={agentAuthor}
      messages={messages}
      onToolApprovalResponse={onToolApprovalResponse}
      showAgentLoading={showAgentLoading}
      status={status}
      withProvider={false}
    >
      {children}
    </PostMessages>
  );
}

export function ChatThreadComposer({
  connected,
  status,
  input,
  chatError,
  header,
  placeholder,
  onAttachmentControlsReady,
  onSubmit,
  onStop,
  onTextChange,
  onError,
  children,
}: {
  connected: boolean;
  status: ChatStatus;
  input: string;
  chatError: string | null;
  header?: ReactNode;
  placeholder: string;
  onAttachmentControlsReady: (controls: {
    add: (files: File[] | FileList) => void;
    clear: () => void;
  }) => void;
  onSubmit: (message: PromptInputMessage) => void;
  onStop: () => void;
  onTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onError: (error: string) => void;
  children?: ReactNode;
}) {
  return (
    <PromptComposer
      chatError={chatError}
      connected={connected}
      header={header}
      input={input}
      onAttachmentControlsReady={onAttachmentControlsReady}
      onError={onError}
      onStop={onStop}
      onSubmit={onSubmit}
      onTextChange={onTextChange}
      placeholder={placeholder}
      status={status}
    >
      {children}
    </PromptComposer>
  );
}

export function ChatThreadReadOnly({ message }: { message: string }) {
  return <div className="border-t px-4 py-3 text-sm text-muted-foreground">{message}</div>;
}
