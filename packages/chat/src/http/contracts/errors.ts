/** Stable machine-readable codes for chat JSON error envelopes. */

export const CHAT_ERROR_CODE = {
  invalid_request: "invalid_request",
  unauthorized: "unauthorized",
  not_found: "not_found",
  internal_error: "internal_error",
} as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODE)[keyof typeof CHAT_ERROR_CODE];

const CHAT_ERROR_CODES = new Set<string>(Object.values(CHAT_ERROR_CODE));

export type ChatErrorEnvelope = {
  error: string;
  code?: ChatErrorCode;
};

export function chatErrorCodeForStatus(status: number): ChatErrorCode {
  if (status === 401) return CHAT_ERROR_CODE.unauthorized;
  if (status === 404) return CHAT_ERROR_CODE.not_found;
  if (status >= 500) return CHAT_ERROR_CODE.internal_error;
  if (status >= 400) return CHAT_ERROR_CODE.invalid_request;
  return CHAT_ERROR_CODE.internal_error;
}

function isChatErrorCode(v: unknown): v is ChatErrorCode {
  return typeof v === "string" && CHAT_ERROR_CODES.has(v);
}

/** Hand-written parser for `{ error, code? }` envelopes (no Zod). */
export function parseChatErrorEnvelope(v: unknown): ChatErrorEnvelope {
  if (typeof v !== "object" || v === null) {
    throw new Error("ChatErrorEnvelope: expected object");
  }
  const o = v as Record<string, unknown>;
  if (typeof o.error !== "string") {
    throw new Error("ChatErrorEnvelope: error must be a string");
  }
  const out: ChatErrorEnvelope = { error: o.error };
  if (isChatErrorCode(o.code)) {
    out.code = o.code;
  }
  return out;
}
