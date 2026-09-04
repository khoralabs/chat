import {
  type ChatErrorCode,
  chatErrorCodeForStatus,
  parseChatErrorEnvelope,
} from "./contracts/errors.ts";

export class ChatHttpClientError extends Error {
  readonly status: number;
  readonly code?: ChatErrorCode;
  readonly bodyText?: string;

  constructor(
    message: string,
    status: number,
    options?: { code?: ChatErrorCode; bodyText?: string },
  ) {
    super(message);
    this.name = "ChatHttpClientError";
    this.status = status;
    this.bodyText = options?.bodyText;
    if (options?.code !== undefined) this.code = options.code;
  }
}

export function throwChatHttpClientError(
  status: number,
  statusText: string,
  bodyText: string,
): never {
  let message = statusText.length > 0 ? statusText : `Chat request failed ${status}`;
  let code: ChatErrorCode | undefined;
  if (bodyText.length > 0) {
    try {
      const parsed = JSON.parse(bodyText) as unknown;
      try {
        const env = parseChatErrorEnvelope(parsed);
        message = env.error;
        code = env.code;
      } catch {
        if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
          const err = (parsed as { error: unknown }).error;
          if (typeof err === "string" && err.length > 0) message = err;
        } else {
          message = bodyText;
        }
      }
    } catch {
      message = bodyText;
    }
  }
  throw new ChatHttpClientError(message, status, {
    code: code ?? chatErrorCodeForStatus(status),
    bodyText,
  });
}
