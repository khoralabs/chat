import type {
  AppendPostInput,
  AppendPostResult,
  ChatPersistence,
  ChatSigner,
  ChatVerifier,
  CompleteStreamedPostInput,
  CompleteStreamedPostResult,
  PreparedAppendPost,
  ScopeRef,
  SignablePostVersion,
  SignedEnvelope,
} from "@khoralabs/chat-core";
import {
  ChatValidationError,
  canonicalSignedPostVersionPayload,
  signedPayloadBytes,
} from "@khoralabs/chat-core";

import { prepareAppendPost } from "./helpers.ts";

export type SignedChatPersistenceOptions = {
  /** Used for stream-complete auto-sign. */
  signer: ChatSigner;
  /** Used for append signature verification. */
  verifier: ChatVerifier;
};

function scopesEqual(a: ScopeRef, b: ScopeRef): boolean {
  return a.type === b.type && a.id === b.id;
}

function preparedToSignable(prepared: PreparedAppendPost): SignablePostVersion {
  return {
    postId: prepared.postId,
    versionId: prepared.versionId,
    threadId: prepared.threadId,
    author: prepared.author,
    role: prepared.message.role,
    parts: prepared.message.parts,
    metadata: prepared.message.metadata,
    mentions: prepared.mentions,
    model: prepared.model,
    usage: prepared.usage,
    parentVersionId: prepared.parentVersionId ?? null,
    previousPostVersionId: prepared.previousPostVersionId,
    contentHash: prepared.contentHash,
    lineageHash: prepared.lineageHash,
  };
}

/** Tip lookup + prepareAppendPost for host-side signing before append. */
export async function prepareAppendForSigning(
  persistence: ChatPersistence,
  input: AppendPostInput,
): Promise<PreparedAppendPost> {
  const tip = await persistence.getThreadTip(input.threadId);
  return prepareAppendPost({
    ...input,
    previousPostVersionId: tip?.id ?? null,
    previousLineageHash: tip?.lineageHash ?? null,
  });
}

/** Sign a prepared append using the host ChatSigner and core canonical payload. */
export async function signPreparedAppendPost(
  signer: ChatSigner,
  author: ScopeRef,
  prepared: PreparedAppendPost,
): Promise<SignedEnvelope> {
  const payload = canonicalSignedPostVersionPayload(preparedToSignable(prepared));
  return signer.sign(signedPayloadBytes(payload), author);
}

async function assertValidAppendSignature(
  prepared: PreparedAppendPost,
  author: ScopeRef,
  envelope: SignedEnvelope,
  verifier: ChatVerifier,
): Promise<void> {
  if (!scopesEqual(envelope.signer, author)) {
    throw new ChatValidationError("appendPost signature signer must match author");
  }
  const payload = canonicalSignedPostVersionPayload(preparedToSignable(prepared));
  const ok = await verifier.verify(signedPayloadBytes(payload), envelope);
  if (!ok) {
    throw new ChatValidationError("invalid post signature");
  }
}

function signableFromCommittedPost(
  post: Extract<CompleteStreamedPostResult, { ok: true }>["post"],
): SignablePostVersion {
  return {
    postId: post.id,
    versionId: post.versionId,
    threadId: post.threadId,
    author: post.author,
    role: post.role,
    parts: post.parts,
    metadata: post.metadata,
    mentions: post.mentions,
    model: post.model,
    usage: post.usage,
    parentVersionId: post.previousVersionId ?? null,
    previousPostVersionId: post.previousPostVersionId ?? null,
    contentHash: post.contentHash,
    lineageHash: post.lineageHash,
  };
}

/**
 * Wrap persistence so committed posts require signatures:
 * - appendPost: requires and verifies `input.signature`
 * - completeStreamedPost: auto-signs the resulting version via `signer`
 */
export function withSignedChatPersistence(
  persistence: ChatPersistence,
  options: SignedChatPersistenceOptions,
): ChatPersistence {
  return new Proxy(persistence, {
    get(target, prop, receiver) {
      if (prop === "appendPost") {
        return async (input: AppendPostInput): Promise<AppendPostResult> => {
          if (!input.signature) {
            throw new ChatValidationError("appendPost requires a signed envelope");
          }
          const prepared = await prepareAppendForSigning(target, input);
          await assertValidAppendSignature(
            prepared,
            input.author,
            input.signature,
            options.verifier,
          );
          return target.appendPost({
            ...input,
            message: prepared.message,
            versionId: prepared.versionId,
            createdAtMs: prepared.createdAtMs,
            signature: input.signature,
          });
        };
      }

      if (prop === "completeStreamedPost") {
        return async (input: CompleteStreamedPostInput): Promise<CompleteStreamedPostResult> => {
          const result = await target.completeStreamedPost(input);
          if (!result.ok) return result;

          const signable = signableFromCommittedPost(result.post);
          const payload = canonicalSignedPostVersionPayload(signable);
          const envelope = await options.signer.sign(
            signedPayloadBytes(payload),
            result.post.author,
          );
          await target.setPostVersionSignature(result.post.versionId, envelope);
          return {
            ok: true,
            post: { ...result.post, signature: envelope },
            head: result.head,
          };
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
