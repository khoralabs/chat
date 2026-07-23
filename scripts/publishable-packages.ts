/**
 * Ordered publishable packages for unified releases (dependency order).
 */
export type PublishablePackage = {
  name: string;
  dir: string;
};

export const PUBLISH_ORDER: PublishablePackage[] = [
  { name: "@khoralabs/chat", dir: "packages/chat" },
  { name: "@khoralabs/chat-react", dir: "packages/chat-react" },
];

export function isSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version);
}
