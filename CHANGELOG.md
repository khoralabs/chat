# Unreleased

## Changed

- `@khoralabs/chat/http` no longer re-exports server, storage, or sqlcipher config helpers; use `./http/server`, `./http/service`, and `./http/config`.
- `@khoralabs/chat/http/client` re-exports `ChatHttpClientError` and HTTP path / error-code contracts for browser hosts.
- New `@khoralabs/chat/sources` entrypoint; `@khoralabs/chat-react` imports `getMessageSources` from it.
- DID-key agent crypto (`./agent`) depends on `@khoralabs/did-key-identity` `^0.2.0` instead of an optional `@khoralabs/relay` peer.
