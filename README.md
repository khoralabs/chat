# Chat packages

Generic, use-case-agnostic messaging ledger libraries for Khora.

| Package | Purpose |
|---------|---------|
| `@khoralabs/chat` | Contracts, hashing, lineage, `createChatService`, persistence backends, HTTP/WS |
| `@khoralabs/chat-react` | Headless hooks and compound components |

## `@khoralabs/chat` entrypoints

| Export | Contents |
|--------|----------|
| `.` | Domain types, hashing, lineage, `createChatService` |
| `./persistence` | Port helpers, memory fixture, signed persistence wrapper |
| `./sqlite` | Bun `bun:sqlite` adapter (WAL, busy timeout) |
| `./turso-serverless` | Turso / local-sqlite SQL adapter |
| `./turso-serverless/sql` | Low-level SQL helpers |
| `./http` | ChatService-shaped HTTP/WS transport |
| `./http/client` `./http/routes` `./http/service` `./http/server` | HTTP submodules |
| `./testing` | `runChatPersistenceContractTests` |

**Runtime:** Bun is required for hashing (`Bun.CryptoHasher`), `./sqlite`, and `./http/server`. Prefer `./turso-serverless` for remote SQL.

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

Opt in with `withSignedChatPersistence` from `@khoralabs/chat/persistence`. Hosts provide `ChatSigner` / `ChatVerifier` (no crypto in chat packages). When wrapped, every committed post version is signed: `appendPost` requires a verified envelope; `completeStreamedPost` auto-signs via the signer.

## HTTP transport

`@khoralabs/chat/http` exposes `createChatService` over HTTP/WS with a shared-secret service token. It does **not** enforce app authz (sessions, SpiceDB, participant policy) — hosts own that layer and call chat HTTP as an internal ledger.

```sh
CHAT_INTERNAL_TOKEN=dev bun run --filter @khoralabs/chat start:http
```

## Release

Publishable packages: `@khoralabs/chat` → `@khoralabs/chat-react` (see `scripts/publishable-packages.ts`).

```sh
bun run build
bun run release:bump 0.1.0
bun run release:publish --dry-run
```

GitHub Actions: `.github/workflows/release.yml` (`workflow_dispatch` or `v*` tag).

## Tests

```sh
bun run format:check
bun run typecheck
bun test
bun run build
```

Hooks (via husky): `pre-commit` runs Biome; `pre-push` runs format check, typecheck, and tests.
