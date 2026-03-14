export type Channel = "customer" | "ops" | "ceo" | `tech:${string}`;
export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

const MAX_HISTORY = 50;

const histories: Map<string, Message[]> = new Map([
  ["customer", []],
  ["ops", []],
  ["ceo", []],
]);

/**
 * Get or create the history array for a channel.
 * Supports dynamic tech channels like "tech:marcus".
 */
function ensureHistory(channel: Channel): Message[] {
  if (!histories.has(channel)) {
    histories.set(channel, []);
  }
  return histories.get(channel)!;
}

export function addMessage(channel: Channel, role: Role, content: string): void {
  const history = ensureHistory(channel);
  history.push({ role, content });
  // Trim oldest messages if over cap
  if (history.length > MAX_HISTORY) {
    histories.set(channel, history.slice(history.length - MAX_HISTORY));
  }
}

export function getHistory(channel: Channel): Message[] {
  return ensureHistory(channel);
}

export function clearHistory(channel: Channel): void {
  histories.set(channel, []);
}

/**
 * Clear all tech channel histories (e.g., on reset).
 */
export function clearAllTechHistories(): void {
  for (const key of histories.keys()) {
    if (key.startsWith("tech:")) {
      histories.set(key, []);
    }
  }
}

/**
 * Inject a system event into the conversation as a user message with SYSTEM prefix.
 * e.g., "SYSTEM: Tech Marcus has confirmed dispatch"
 */
export function addSystemEvent(channel: Channel, event: string): void {
  addMessage(channel, "user", `SYSTEM: ${event}`);
}
