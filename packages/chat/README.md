# `@khoralabs/chat`

Signed chat ledger: domain service, persistence backends, and HTTP/WS transport.

Requires **Bun** for hashing, `./sqlite`, and `./http/server`. Use `./turso-serverless` for Turso/libSQL-style SQL.

Optional peer `@khoralabs/sqlite-crypto`: set `CHAT_SQLCIPHER_KEY` (≥16 chars) or pass `sqlCipherKey` to `createChatDatabase` / `createLocalSqliteDatabase` for SQLCipher; omit for plaintext.

See the [repo README](../../README.md) for the full entrypoint map.
