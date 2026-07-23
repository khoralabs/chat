export class ChatError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChatError";
    this.code = code;
  }
}

export class ChatNotFoundError extends ChatError {
  readonly resource: string;
  readonly resourceId: string;

  constructor(resource: string, resourceId: string) {
    super("not_found", `${resource} not found: ${resourceId}`);
    this.name = "ChatNotFoundError";
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

export class ChatConflictError extends ChatError {
  readonly reason: "head_conflict" | "idempotency_mismatch" | "stream_revision_conflict";

  constructor(
    reason: "head_conflict" | "idempotency_mismatch" | "stream_revision_conflict",
    message: string,
  ) {
    super("conflict", message);
    this.name = "ChatConflictError";
    this.reason = reason;
  }
}

export class ChatValidationError extends ChatError {
  constructor(message: string) {
    super("validation", message);
    this.name = "ChatValidationError";
  }
}

export class ChatPermissionError extends ChatError {
  constructor(message: string) {
    super("permission_denied", message);
    this.name = "ChatPermissionError";
  }
}

/** Duck-typed check — safe across multi-entrypoint bundles where `instanceof` can fail. */
export function isChatNotFoundError(error: unknown): error is ChatNotFoundError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as Error).name === "ChatNotFoundError" &&
    (error as ChatError).code === "not_found" &&
    typeof (error as ChatNotFoundError).resource === "string" &&
    typeof (error as ChatNotFoundError).resourceId === "string"
  );
}
