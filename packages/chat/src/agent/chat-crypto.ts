import type { Signer } from "@khoralabs/did-key-identity";
import { ed25519PublicKeyBytesFromDid } from "@khoralabs/did-key-identity";
import { verifyAsync } from "@noble/ed25519";
import type { ChatSigner, ChatVerifier, ScopeRef, SignedEnvelope } from "../domain.ts";

export const DID_KEY_CHAT_SIGNATURE_ALGORITHM = "ed25519";

export type ResolveDidKeyChatSigner = (did: string) => Promise<Signer | undefined>;

function signatureBytesToB64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function signatureBytesFromB64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

/** Adapt DID keys (`Signer`) to `ChatSigner` / `ChatVerifier` for signed chat posts. */
export function createDidKeyChatCrypto(resolveSigner: ResolveDidKeyChatSigner): {
  signer: ChatSigner;
  verifier: ChatVerifier;
} {
  return {
    signer: {
      async sign(payload: Uint8Array, author: ScopeRef): Promise<SignedEnvelope> {
        const key = await resolveSigner(author.id);
        if (key === undefined) {
          throw new Error(`no signing key for ${author.type} ${author.id}`);
        }
        if (key.did !== author.id) {
          throw new Error("resolved signer did does not match author id");
        }
        const signature = await key.sign(payload);
        return {
          algorithm: DID_KEY_CHAT_SIGNATURE_ALGORITHM,
          signer: author,
          signature: signatureBytesToB64Url(signature),
          signedAtMs: Date.now(),
        };
      },
    },
    verifier: {
      async verify(payload: Uint8Array, envelope: SignedEnvelope): Promise<boolean> {
        if (envelope.algorithm !== DID_KEY_CHAT_SIGNATURE_ALGORITHM) return false;
        try {
          const pubKey = ed25519PublicKeyBytesFromDid(envelope.signer.id);
          return await verifyAsync(signatureBytesFromB64Url(envelope.signature), payload, pubKey);
        } catch {
          return false;
        }
      },
    },
  };
}
