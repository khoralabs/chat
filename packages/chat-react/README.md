# `@khoralabs/chat-react`

React hooks and UI for `@khoralabs/chat`.

```ts
import { ChatProvider, useThreadPosts } from "@khoralabs/chat-react";
import { ChatThreadView } from "@khoralabs/chat-react/ui";
import "@khoralabs/chat-react/styles/globals.css";
```

Peers: `react`, `react-dom` (^18 || ^19).

`postToDisplayMessage` maps host-written `metadata.sources` (`ChatSourceWire`) to source attachments. Resolving originals is the host's job via their `@khoralabs/sourcemaps` `Store`.
