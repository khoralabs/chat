# Unreleased

## Changed

- `@khoralabs/chat/http` no longer re-exports server, storage, or sqlcipher config helpers; use `./http/server`, `./http/service`, and `./http/config`.
- `@khoralabs/chat/http/client` re-exports `ChatHttpClientError` and HTTP path / error-code contracts for browser hosts.
- New `@khoralabs/chat/sources` entrypoint; `@khoralabs/chat-react` imports `getMessageSources` from it.
- Optional peer `@khoralabs/relay` bumped to `^0.3.0`.
