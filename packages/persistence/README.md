# @khoralabs/chat-persistence

Async persistence port implementations and shared adapter contract tests.

## Exports

- Re-exports persistence types from `@khoralabs/chat-core`
- `BaseChatPersistence` — shared validation helpers for adapters
- `prepareAppendPost`, `prepareEditPost`, `buildAclEventContentHash`
- `MemoryChatPersistence` / `createMemoryChatPersistence()` — test fixture
- `withSignedChatPersistence`, `prepareAppendForSigning`, `signPreparedAppendPost` — opt-in signed append / stream-complete
- `runChatPersistenceContractTests(name, factory)` — shared contract suite

## Signed persistence

Wrap any `ChatPersistence` so committed posts are signed:

```ts
import {
  createMemoryChatPersistence,
  prepareAppendForSigning,
  signPreparedAppendPost,
  withSignedChatPersistence,
} from "@khoralabs/chat-persistence";

const persistence = withSignedChatPersistence(createMemoryChatPersistence(), {
  signer,   // ChatSigner — host crypto
  verifier, // ChatVerifier — host crypto
});

// Append: prepare → sign → append with signature
const prepared = await prepareAppendForSigning(persistence, appendInput);
const signature = await signPreparedAppendPost(signer, author, prepared);
await persistence.appendPost({
  ...appendInput,
  versionId: prepared.versionId,
  message: prepared.message,
  createdAtMs: prepared.createdAtMs,
  signature,
});

// Stream complete: wrapper auto-signs the resulting version via ChatSigner
```

When wrapped, unsigned `appendPost` is rejected. Crypto stays out of chat packages — supply `ChatSigner` / `ChatVerifier`.

## Contract tests

Adapter packages should run the shared suite:

```ts
import { runChatPersistenceContractTests } from "@khoralabs/chat-persistence";

runChatPersistenceContractTests("my-adapter", () => createMyAdapter());
```

Coverage includes channel/thread creation, recursive threads, append concurrency, edits, soft delete, ACL events, idempotency keys, lineage walks, and `setPostVersionSignature`.

## Design notes

- All APIs are async-first for workflow/process boundaries
- `appendPost` / `editPost` return typed head conflicts instead of silent overwrites
- Idempotency keys make workflow retries safe
- ACL mutations append signed events and maintain derived membership tables
