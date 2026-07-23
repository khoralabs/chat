# `@khoralabs/chat-http`

ChatService-shaped HTTP/WS transport for the chat ledger.

## Boundary

This package is an **open ledger behind a machine credential** (`CHAT_INTERNAL_TOKEN`). It does not enforce app identity, SpiceDB grants, or participant policy — hosts own that layer.

```
App gateway (session / authz / AgentChatClient)
        │ Bearer service token
        ▼
   chat-http (this package)
        │
        ▼
   createChatService + persistence
```

## Usage

```ts
import { createChatClient } from "@khoralabs/chat-http/client";
import { createChatHttpRuntime } from "@khoralabs/chat-http/service";
import { createMemoryChatPersistence } from "@khoralabs/chat-persistence";

const runtime = createChatHttpRuntime({
  persistence: createMemoryChatPersistence(),
});
```

Runnable server:

```sh
CHAT_INTERNAL_TOKEN=dev bun run --filter @khoralabs/chat-http start
```

Env: `CHAT_INTERNAL_TOKEN`, `CHAT_DB_PATH` / `CHAT_DATA_DIR`, optional `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, `PORT` (default 3002).
