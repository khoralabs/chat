# `@khoralabs/chat`

Signed chat ledger: domain service, persistence backends, and HTTP/WS transport.

Requires **Bun** for hashing, `./sqlite`, and `./http/server`. Use `./turso-serverless` for Turso/libSQL-style SQL.

Optional peer `@khoralabs/sqlite-crypto`: set `CHAT_SQLCIPHER_KEY` (≥16 chars) or pass `sqlCipherKey` to `createChatDatabase` / `createLocalSqliteDatabase` for SQLCipher; omit for plaintext.

See the [repo README](../../README.md) for the full entrypoint map.

## Message metadata conventions

`UIMessage.metadata` is an opaque bag hashed with `parts`. Chat-react recognizes:

| Key | Role |
|-----|------|
| `kickoff` | Hide synthetic kickoff posts from display |
| `displayText` | Override concatenated text parts for display |
| `documents` | Uploaded file stubs → display attachments |
| `sources` | Host-attached external refs (`ChatSourceWire[]`) |

### External sources (`metadata.sources`)

Hosts attach sourcemap addresses when their **agent tools** cite originals during response generation. Chat persists them and can display chips; it does **not** resolve content.

```ts
import type { ChatSourceWire } from "@khoralabs/chat";
import type { Store } from "@khoralabs/sourcemaps";

// Host writes onto the assistant message before/while appending:
message.metadata = {
  ...message.metadata,
  sources: [
    {
      id: "cite-1",
      title: "Design doc",
      mediaType: "text/markdown",
      sourceRef: {
        domain: "document",
        org_id: "…",
        document_id: "…",
        // …host locators
        content_hash: "…", // when using ContentAddressedRef
      },
    } satisfies ChatSourceWire,
  ],
};

// Host resolves when UI or agent needs the original:
const store: Store<typeof sourceRef> = createHostStore(/* … */);
const original = await store.resolve(sourceRef);
```

**Host owns:** tool wiring, locator schemas, `Store` implementations, projections.  
**Chat owns:** `ChatSourceWire` envelope + ledger persistence of whatever metadata the host appends.
