export const OWNER_IDS = new Set(["1456824205545967713"]);
export const LOG_CHANNEL_ID = "1519111387626868938";
export const PING_USER_ID = "1456824205545967713";

export function isOwner(userId: string): boolean {
  return OWNER_IDS.has(userId);
}
