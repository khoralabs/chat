# Chat packages

Generic, use-case-agnostic messaging ledger libraries for Khora.

| Package | Purpose |
|---------|---------|
| `@khoralabs/chat-core` | Contracts, hashing, lineage, `createChatService` |
| `@khoralabs/chat-persistence` | Persistence port helpers, memory fixture, contract tests, opt-in signed persistence |
| `@khoralabs/chat-persistence-sqlite` | Bun SQLite adapter (WAL, busy timeout) |
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

## Status

These packages are standalone. Exedra integration is a separate task.

## Tests

```sh
bun run format:check
bun run typecheck
bun test
```

Hooks (via husky): `pre-commit` runs Biome; `pre-push` runs format check, typecheck, and tests.
