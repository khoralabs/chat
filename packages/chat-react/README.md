# `@khoralabs/chat-react`

React hooks and UI for `@khoralabs/chat`.

```ts
import { ChatProvider, useThreadPosts } from "@khoralabs/chat-react";
import { ChatThreadView } from "@khoralabs/chat-react/ui";
import "@khoralabs/chat-react/styles/globals.css";
```

Peers: `react`, `react-dom` (^18 || ^19).

`postToDisplayMessage` maps host-written `metadata.sources` (`ChatSourceWire`) to source attachments. Resolving originals is the host's job via their `@khoralabs/sourcemaps` `Store`.

`CodeBlock` and Streamdown’s `@streamdown/code` plugin both need `shiki`. Upstream `@streamdown/code` still depends on shiki 3 (even at latest), so this package pins `shiki@3.23.0` and the monorepo root `overrides.shiki` keeps a single copy — mixed majors break `PluginConfig` typing at build time.
