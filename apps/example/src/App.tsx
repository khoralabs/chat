import {
  ChannelRoot,
  ChatProvider,
  type DisplayMessage,
  PostAuthor,
  PostItem,
  PostList,
  PostParts,
  postsToDisplayMessages,
  ThreadRoot,
  useAgentLoadingIndicator,
  useChannel,
  useChatDragDrop,
  usePostComposer,
  useThreadPosts,
  useThreads,
} from "@khoralabs/chat-react";
import {
  Attachment,
  type AttachmentData,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
  ChatAuthorAvatar,
  ChatDropOverlay,
  ChatThreadView,
  CodeBlock,
  Message,
  MessageContent,
  MessageHeader,
  MessageResponse,
  MessageTimestamp,
  PostMessage,
  PostMessageAttachments,
  PostMessageContent,
  PostMessageHeader,
  PostMessages,
  PostMessagesEmpty,
  PostMessagesLoading,
  PostMessageTimestamp,
  PromptComposer,
  type PromptInputMessage,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Shimmer,
  Tool,
  type ToolApprovalResponse,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@khoralabs/chat-react/ui";
import type { ChatStatus } from "ai";
import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { chatClient, type DemoBootstrap, loadDemoBootstrap, runAgent } from "./chat-client";

const userAuthor = { name: "Demo User" };
const agentAuthor = { name: "Tool Loop Agent" };

const mockAttachment: AttachmentData = {
  id: "mock-file",
  type: "file",
  filename: "component-catalog.md",
  mediaType: "text/markdown",
  url: "#",
};

const now = Date.now();

function buildCatalogMessages(): DisplayMessage[] {
  return [
    {
      id: "catalog-user",
      role: "user",
      parts: [{ type: "text", text: "Show the chat primitives with a file attachment." }],
      createdAtMs: now - 120_000,
      author: userAuthor,
      attachments: [
        {
          id: "mock-file",
          fileName: "component-catalog.md",
          mediaType: "text/markdown",
          url: "#",
        },
      ],
    },
    {
      id: "catalog-agent",
      role: "assistant",
      parts: [
        {
          type: "tool-inspectCatalog",
          toolCallId: "catalog-tool",
          state: "output-available",
          input: { components: ["PostMessages", "PromptComposer", "ChatThreadView"] },
          output: { represented: true },
        },
        {
          type: "text",
          text: "Here is a static message with markdown, a tool call, attribution, and timestamp.",
        },
      ],
      createdAtMs: now - 110_000,
      author: agentAuthor,
    },
    {
      id: "catalog-user-reasoning",
      role: "user",
      parts: [{ type: "text", text: "Why might scroll-fade help long threads?" }],
      createdAtMs: now - 90_000,
      author: userAuthor,
    },
    {
      id: "catalog-agent-reasoning",
      role: "assistant",
      parts: [
        {
          type: "reasoning",
          text: "Long threads bury older context. A soft edge fade signals overflow without a scrollbar chrome fight, and keeps focus on the latest turn.",
          state: "done",
        },
        {
          type: "text",
          text: "Scroll-fade softens the edges so overflow is obvious without competing with message content.",
        },
      ],
      createdAtMs: now - 80_000,
      author: agentAuthor,
    },
    {
      id: "catalog-user-approval",
      role: "user",
      parts: [{ type: "text", text: "Delete the temporary catalog draft." }],
      createdAtMs: now - 60_000,
      author: userAuthor,
    },
    {
      id: "catalog-agent-approval",
      role: "assistant",
      parts: [
        {
          type: "tool-delete_draft",
          toolCallId: "catalog-delete",
          state: "approval-requested",
          input: { path: "/tmp/catalog-draft.md" },
          approval: { id: "appr-catalog-1" },
        },
      ],
      createdAtMs: now - 50_000,
      author: agentAuthor,
    },
    {
      id: "catalog-user-2",
      role: "user",
      parts: [
        { type: "text", text: "Scroll this list — Conversation uses scroll-fade on overflow." },
      ],
      createdAtMs: now - 40_000,
      author: userAuthor,
    },
    {
      id: "catalog-agent-2",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "At rest the bottom edge fades. Mid-scroll both edges fade. At the end the bottom sharpens.",
        },
      ],
      createdAtMs: now - 30_000,
      author: agentAuthor,
    },
    {
      id: "catalog-user-3",
      role: "user",
      parts: [{ type: "text", text: "Keep going so the viewport overflows." }],
      createdAtMs: now - 20_000,
      author: userAuthor,
    },
    {
      id: "catalog-agent-3",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "Extra turns fill the column so you can feel the mask dissolve content at the edges—no overlay, no scroll listeners.",
        },
      ],
      createdAtMs: now - 10_000,
      author: agentAuthor,
    },
  ];
}

const wideCodeSample = `const scrollFadeDemo = { conversation: "scroll-fade", codeBlock: "scroll-fade-x", toolOutput: "scroll-fade-x", note: "wide lines overflow horizontally" };`;

function resolveAuthor(author: { type: string; id: string }) {
  if (author.type === "agent") return agentAuthor;
  return userAuthor;
}

export function App() {
  const [bootstrap, setBootstrap] = useState<DemoBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDemoBootstrap()
      .then(setBootstrap)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, []);

  if (error) {
    return <main className="p-8 text-destructive">Could not load demo: {error}</main>;
  }

  if (!bootstrap) {
    return <main className="p-8 text-muted-foreground">Loading chat demo…</main>;
  }

  return (
    <ChatProvider client={chatClient}>
      <ChannelRoot channelId={bootstrap.channel.id}>
        <ThreadRoot threadId={bootstrap.thread.id}>
          <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 p-6">
            <header className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Chat framework demo</p>
              <h1 className="text-4xl font-semibold tracking-tight">
                `@khoralabs/chat-react` catalog and live agent
              </h1>
              <p className="max-w-3xl text-muted-foreground">
                Static examples cover Reasoning, tool Confirmation, Chain of Thought, and the rest
                of the component surface. The live panel uses hooks, SSE events, and a SQLite-backed
                tool-loop agent. Try:
                <code className="mx-2 rounded bg-muted px-2 py-1">remember color = blue</code>
              </p>
            </header>

            <HookStatus channelId={bootstrap.channel.id} threadId={bootstrap.thread.id} />

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <LiveChat threadId={bootstrap.thread.id} />
              <ComponentCatalog />
            </section>
          </main>
        </ThreadRoot>
      </ChannelRoot>
    </ChatProvider>
  );
}

function HookStatus({ channelId, threadId }: { channelId: string; threadId: string }) {
  const channel = useChannel(channelId);
  const threads = useThreads(channelId);
  const posts = useThreadPosts(threadId);
  const composer = usePostComposer(threadId);
  const firstPostId = posts.posts[0]?.id;

  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4 text-sm md:grid-cols-4">
      <Status
        label="useChannel"
        value={channel.channel?.id ?? (channel.loading ? "loading" : "n/a")}
      />
      <Status label="useThreads" value={`${threads.threads.length} thread(s)`} />
      <Status label="useThreadPosts" value={`${posts.posts.length} post(s)`} />
      <button
        className="rounded-md border px-3 py-2 text-left hover:bg-accent"
        type="button"
        onClick={() => {
          void composer.submit({
            author: { type: "account", id: "demo-user" },
            message: {
              id: crypto.randomUUID(),
              role: "user",
              parts: [{ type: "text", text: "Direct append from usePostComposer." }],
            },
          });
        }}
      >
        usePostComposer: append note
      </button>
      <PostList>
        {() =>
          firstPostId ? (
            <PostItem postId={firstPostId}>
              {(post) => (
                <div className="md:col-span-4 rounded-md bg-muted p-3">
                  <PostAuthor postId={post.id}>
                    {(author) => (
                      <span>
                        PostAuthor: {author.type}/{author.id}
                      </span>
                    )}
                  </PostAuthor>
                  <PostParts postId={post.id}>
                    {(parts) => <span className="ml-3">PostParts: {parts.length} part(s)</span>}
                  </PostParts>
                </div>
              )}
            </PostItem>
          ) : (
            <div className="md:col-span-4 rounded-md bg-muted p-3">
              PostList is ready; send a live message to populate it.
            </div>
          )
        }
      </PostList>
    </section>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function LiveChat({ threadId }: { threadId: string }) {
  const { posts, refresh } = useThreadPosts(threadId);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [chatError, setChatError] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ postId: string } | null>(null);
  const dragDrop = useChatDragDrop(true);
  const messages = useMemo(() => postsToDisplayMessages(posts, { resolveAuthor }), [posts]);
  const loading = useAgentLoadingIndicator({ status, messages });

  const submit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text) return;
    setChatError(null);
    setStatus("submitted");
    setInput("");
    try {
      await runAgent({ threadId, text });
      await refresh();
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStatus("ready");
    }
  };

  return (
    <section className="min-h-[720px] overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-4">
        <h2 className="text-xl font-semibold">Live SQLite tool-loop chat</h2>
        <p className="text-sm text-muted-foreground">
          Messages persist in <code>packages/example/sqlite</code>. The agent streams a tool call
          and stores facts in a separate SQLite table. Scroll uses{" "}
          <code className="rounded bg-muted px-1">MessageScroller</code> with{" "}
          <code className="rounded bg-muted px-1">scroll-fade</code>.
        </p>
      </div>
      <ChatThreadView
        agentAuthor={agentAuthor}
        awaitingOpening={messages.length === 0}
        canWrite
        chatError={chatError}
        chatRootRef={dragDrop.chatRootRef}
        connected
        input={input}
        isDragActive={dragDrop.isDragActive}
        messages={messages}
        onAttachmentControlsReady={dragDrop.handleAttachmentControlsReady}
        onError={setChatError}
        onScrollTargetComplete={() => setScrollTarget(null)}
        onStop={() => setStatus("ready")}
        onSubmit={submit}
        onTextChange={(event) => setInput(event.currentTarget.value)}
        placeholder="Ask something, or type: remember project = khora"
        scrollTarget={scrollTarget}
        showAgentLoading={loading}
        status={status}
      />
      <div className="flex flex-wrap gap-2 border-t p-3">
        <button
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          type="button"
          onClick={() => {
            const last = messages.at(-1);
            if (last) setScrollTarget({ postId: last.id });
          }}
        >
          scrollToMessage: jump to latest
        </button>
        <button
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          type="button"
          onClick={() => {
            const first = messages.at(0);
            if (first) setScrollTarget({ postId: first.id });
          }}
        >
          scrollToMessage: jump to first
        </button>
      </div>
    </section>
  );
}

function applyToolApproval(
  messages: DisplayMessage[],
  response: ToolApprovalResponse,
): DisplayMessage[] {
  return messages.map((message) => {
    if (message.id !== response.messageId) return message;
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (
          typeof part.type !== "string" ||
          !part.type.startsWith("tool-") ||
          !("toolCallId" in part) ||
          part.toolCallId !== response.toolCallId
        ) {
          return part;
        }
        const toolPart = part as {
          type: `tool-${string}`;
          toolCallId: string;
          state: string;
          input: unknown;
          output?: unknown;
          approval?: { id: string; approved?: boolean };
        };
        if (response.approved) {
          return {
            type: toolPart.type,
            toolCallId: toolPart.toolCallId,
            state: "output-available" as const,
            input: toolPart.input ?? {},
            output: {
              deleted: true,
              path: (toolPart.input as { path?: string } | undefined)?.path,
            },
            approval: { id: response.approvalId, approved: true as const },
          };
        }
        return {
          type: toolPart.type,
          toolCallId: toolPart.toolCallId,
          state: "output-denied" as const,
          input: toolPart.input ?? {},
          approval: { id: response.approvalId, approved: false as const },
        };
      }),
    };
  });
}

function ComponentCatalog() {
  const [catalogMessages, setCatalogMessages] = useState(buildCatalogMessages);

  return (
    <aside className="space-y-6">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 text-xl font-semibold">Static component catalog</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Includes Reasoning parts, an interactive Confirmation tool, and{" "}
          <code className="rounded bg-muted px-1">scroll-fade</code> overflow.
        </p>
        <div className="h-[420px] overflow-hidden rounded-lg border">
          <PostMessages
            loadingAuthor={agentAuthor}
            messages={catalogMessages}
            onToolApprovalResponse={(response) => {
              setCatalogMessages((current) => applyToolApproval(current, response));
            }}
            status="ready"
          >
            <PostMessagesEmpty />
            {catalogMessages.map((message) => (
              <PostMessage key={message.id} message={message}>
                <PostMessageHeader />
                <PostMessageAttachments>
                  <Attachments className="mb-2" variant="grid">
                    <Attachment data={mockAttachment}>
                      <AttachmentPreview />
                    </Attachment>
                  </Attachments>
                </PostMessageAttachments>
                <PostMessageContent />
                <PostMessageTimestamp />
              </PostMessage>
            ))}
            <PostMessagesLoading />
          </PostMessages>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 font-semibold">PromptComposer</h3>
        <PromptComposer
          chatError={null}
          connected
          input=""
          onAttachmentControlsReady={() => undefined}
          onError={() => undefined}
          onStop={() => undefined}
          onSubmit={() => undefined}
          onTextChange={() => undefined}
          placeholder="Static composer shell"
          status="ready"
        />
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 font-semibold">Primitives</h3>
        <div className="space-y-4">
          <Message from="assistant">
            <MessageHeader author={agentAuthor} from="assistant" />
            <MessageContent>
              <MessageResponse>Markdown **response** via `MessageResponse`.</MessageResponse>
            </MessageContent>
            <MessageTimestamp from="assistant" label="Just now" />
          </Message>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Reasoning</p>
            <Reasoning defaultOpen>
              <ReasoningTrigger />
              <ReasoningContent>
                Standalone Reasoning block — hosts can also rely on default part rendering.
              </ReasoningContent>
            </Reasoning>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Chain of Thought (compose; not auto-built from parts)
            </p>
            <ChainOfThought defaultOpen>
              <ChainOfThoughtHeader>Catalog walkthrough</ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                <ChainOfThoughtStep
                  label="Inspect request"
                  description="Parse which primitives the demo should highlight"
                  status="complete"
                />
                <ChainOfThoughtStep
                  label="Search component docs"
                  description="Match Elements patterns to chat-react exports"
                  status="complete"
                >
                  <ChainOfThoughtSearchResults>
                    <ChainOfThoughtSearchResult>reasoning</ChainOfThoughtSearchResult>
                    <ChainOfThoughtSearchResult>confirmation</ChainOfThoughtSearchResult>
                    <ChainOfThoughtSearchResult>chain-of-thought</ChainOfThoughtSearchResult>
                  </ChainOfThoughtSearchResults>
                </ChainOfThoughtStep>
                <ChainOfThoughtStep
                  label="Render catalog"
                  description="Wire static messages + interactive approval"
                  status="active"
                />
              </ChainOfThoughtContent>
            </ChainOfThought>
          </div>

          <Attachments variant="list">
            <Attachment data={mockAttachment}>
              <AttachmentPreview />
              <AttachmentInfo showMediaType />
            </Attachment>
          </Attachments>

          <Tool defaultOpen>
            <ToolHeader
              state="output-available"
              title="inspectCatalog"
              type="tool-inspectCatalog"
            />
            <ToolContent>
              <ToolInput input={{ static: true }} />
              <ToolOutput
                errorText={undefined}
                output={
                  <table className="min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">Component</th>
                        <th className="p-2">Class</th>
                        <th className="p-2">Axis</th>
                        <th className="p-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2">Conversation</td>
                        <td className="p-2">scroll-fade</td>
                        <td className="p-2">y</td>
                        <td className="p-2">message list overflow</td>
                      </tr>
                      <tr>
                        <td className="p-2">CodeBlock / ToolOutput</td>
                        <td className="p-2">scroll-fade-x</td>
                        <td className="p-2">x</td>
                        <td className="p-2">wide lines and tables</td>
                      </tr>
                    </tbody>
                  </table>
                }
              />
            </ToolContent>
          </Tool>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              CodeBlock <code className="rounded bg-muted px-1">scroll-fade-x</code>
            </p>
            <CodeBlock code={wideCodeSample} language="ts" />
          </div>
          <p className="text-sm text-muted-foreground">
            <Shimmer as="span">Shimmer loading text</Shimmer>
          </p>
          <div className="relative h-28 rounded-lg border">
            <ChatDropOverlay active />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ChatAuthorAvatar author={agentAuthor} />
            ChatAuthorAvatar
          </div>
        </div>
      </section>
    </aside>
  );
}

export default App;
