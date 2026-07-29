"use client";

import {
  MessageScroller,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import type { UIMessage } from "ai";
import { ArrowDownIcon, DownloadIcon } from "lucide-react";
import { type ComponentProps, createContext, type ReactNode, useCallback, useContext } from "react";
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";

const ConversationProviderScopeContext = createContext(false);

export function useConversationProviderScope(): boolean {
  return useContext(ConversationProviderScopeContext);
}

export type ConversationProviderProps = ComponentProps<typeof MessageScroller.Provider>;

export const ConversationProvider = ({
  autoScroll = true,
  defaultScrollPosition = "end",
  children,
  ...props
}: ConversationProviderProps) => (
  <ConversationProviderScopeContext.Provider value={true}>
    <MessageScroller.Provider
      autoScroll={autoScroll}
      defaultScrollPosition={defaultScrollPosition}
      {...props}
    >
      {children}
    </MessageScroller.Provider>
  </ConversationProviderScopeContext.Provider>
);

export type ConversationProps = ComponentProps<typeof MessageScroller.Root>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <MessageScroller.Root
    className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<typeof MessageScroller.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <MessageScroller.Viewport className="min-h-0 flex-1 scroll-fade overflow-y-auto">
    <MessageScroller.Content className={cn("flex flex-col gap-8 p-4", className)} {...props} />
  </MessageScroller.Viewport>
);

export type ConversationItemProps = ComponentProps<typeof MessageScroller.Item>;

export const ConversationItem = ({ className, ...props }: ConversationItemProps) => (
  <MessageScroller.Item className={cn(className)} {...props} />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof MessageScroller.Button>;

export const ConversationScrollButton = ({
  className,
  children,
  ...props
}: ConversationScrollButtonProps) => (
  <MessageScroller.Button
    className={cn(
      "absolute bottom-4 left-[50%] z-10 flex size-10 translate-x-[-50%] items-center justify-center rounded-full border bg-background shadow-sm dark:bg-background dark:hover:bg-muted data-[active=false]:pointer-events-none data-[active=false]:opacity-0",
      className,
    )}
    type="button"
    {...props}
  >
    {children ?? <ArrowDownIcon className="size-4" />}
  </MessageScroller.Button>
);

const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

export type ConversationDownloadProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  messages: UIMessage[];
  filename?: string;
  formatMessage?: (message: UIMessage, index: number) => string;
};

const defaultFormatMessage = (message: UIMessage): string => {
  const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1);
  return `**${roleLabel}:** ${getMessageText(message)}`;
};

export const messagesToMarkdown = (
  messages: UIMessage[],
  formatMessage: (message: UIMessage, index: number) => string = defaultFormatMessage,
): string => messages.map((msg, i) => formatMessage(msg, i)).join("\n\n");

export const ConversationDownload = ({
  messages,
  filename = "conversation.md",
  formatMessage = defaultFormatMessage,
  className,
  children,
  ...props
}: ConversationDownloadProps) => {
  const handleDownload = useCallback(() => {
    const markdown = messagesToMarkdown(messages, formatMessage);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [messages, filename, formatMessage]);

  return (
    <Button
      className={cn(
        "absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted",
        className,
      )}
      onClick={handleDownload}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? <DownloadIcon className="size-4" />}
    </Button>
  );
};

export { useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility };
