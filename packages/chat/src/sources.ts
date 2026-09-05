import type { ContentAddressedRef, SourceRef } from "@khoralabs/sourcemaps";

/**
 * Wire envelope for an external source cited on a chat message.
 *
 * Hosts write these into `message.metadata.sources` during agent response
 * generation. Locators are host-defined; chat only constrains this envelope.
 * Resolve originals via the host's own `Store` — chat never resolves.
 */
export type ChatSourceWire<Locators extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  title?: string;
  mediaType?: string;
  /** Address only — host Store resolves */
  sourceRef: SourceRef<Locators> | ContentAddressedRef<Locators>;
};

/** Known keys hosts may set on `UIMessage.metadata` for chat UI display. */
export type ChatMessageMetadata = {
  kickoff?: boolean;
  displayText?: string;
  documents?: ChatDocumentWire[];
  /** External sourcemap refs attached by the host agent/tools */
  sources?: ChatSourceWire[];
};

export type ChatDocumentWire = {
  id: string;
  fileName: string;
  mimeType?: string;
  mediaType?: string;
  byteSize?: number;
};

export function isChatSourceWire(value: unknown): value is ChatSourceWire {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.sourceRef === "object" &&
    record.sourceRef !== null
  );
}

export function getMessageSources(metadata: unknown): ChatSourceWire[] {
  if (typeof metadata !== "object" || metadata === null) return [];
  const sources = (metadata as ChatMessageMetadata).sources;
  if (!Array.isArray(sources)) return [];
  return sources.filter(isChatSourceWire);
}
