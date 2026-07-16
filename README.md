# Chat packages

Generic, use-case-agnostic messaging ledger libraries for Khora.

| Package | Purpose |
|---------|---------|
| `@khoralabs/chat-core` | Contracts, hashing, lineage, `createChatService` |
| `@khoralabs/chat-persistence` | Persistence port helpers, memory fixture, contract tests, opt-in signed persistence |
| `@khoralabs/chat-persistence-sqlite` | Bun SQLite adapter (WAL, busy timeout) |
| `@khoralabs/chat-persistence-turso` | Turso / local-sqlite SQL adapter |
| `@khoralabs/chat-http` | ChatService-shaped HTTP/WS transport (open ledger behind a service token) |
| `@khoralabs/chat-react` | Headless hooks and compound components |

## Model

```
Channel
  └── Thread (root = channel)
        └── Post (AI SDK UIMessage + ledger fields)
              └── Thread (root = post)  // recursive subthreads
```

- **Scope** authors posts and receives ACL grants
- **PostVersion** rows are immutable; edits and branches use parent/version pointers
- **ThreadHead** refs select which lineage to display
- **ChatAclEvent** append-only ACL history with derived membership tables

## Signed posts

Opt in with `withSignedChatPersistence` from `@khoralabs/chat-persistence`. Hosts provide `ChatSigner` / `ChatVerifier` (no crypto in chat packages). When wrapped, every committed post version is signed: `appendPost` requires a verified envelope; `completeStreamedPost` auto-signs via the signer.

## HTTP transport

`@khoralabs/chat-http` exposes `createChatService` over HTTP/WS with a shared-secret service token. It does **not** enforce app authz (sessions, SpiceDB, participant policy) — hosts own that layer and call chat-http as an internal ledger.

```sh
CHAT_INTERNAL_TOKEN=dev bun run --filter @khoralabs/chat-http start
```

## Status

These packages are standalone. Hosts (Exedra, agent-net) consume them via workspace/submodule.

## Tests

```sh
bun run format:check
bun run typecheck
bun test
```

Hooks (via husky): `pre-commit` runs Biome; `pre-push` runs format check, typecheck, and tests.
