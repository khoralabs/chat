import path from "node:path";

export function resolveChatDataDir(): string {
  const raw = process.env.CHAT_DATA_DIR?.trim();
  if (raw !== undefined && raw.length > 0) return raw;
  return path.join(process.cwd(), "data");
}

export function resolveChatDbPath(): string {
  const raw = process.env.CHAT_DB_PATH?.trim();
  if (raw !== undefined && raw.length > 0) return raw;
  return path.join(resolveChatDataDir(), "chat.db");
}

export function chatInternalToken(): string {
  const value = process.env.CHAT_INTERNAL_TOKEN?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error("CHAT_INTERNAL_TOKEN must be set");
  }
  return value;
}

export function chatHttpPort(): number {
  return Number(process.env.PORT?.trim() || "3002");
}
