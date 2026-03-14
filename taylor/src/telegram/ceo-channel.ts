import type { Telegraf } from "telegraf";

let bot: Telegraf | null = null;
let ceoGroupId: string | number = "";

/**
 * Initialize the CEO channel with the bot instance and group ID.
 * Returns false if no CEO group is configured (optional channel).
 */
export function initCeoChannel(
  telegrafBot: Telegraf,
  groupId: string | number,
): boolean {
  if (!groupId) return false;
  bot = telegrafBot;
  ceoGroupId = groupId;
  console.log("Connected to CEO channel");
  return true;
}

/**
 * Check whether the CEO channel is configured.
 */
export function isCeoChannelConfigured(): boolean {
  return bot !== null && ceoGroupId !== "";
}

/**
 * Get the CEO group ID (for routing incoming messages).
 */
export function getCeoGroupId(): string {
  return String(ceoGroupId);
}

/**
 * Post a plain message to the CEO channel.
 */
export async function postToCeo(message: string): Promise<void> {
  if (!bot || !ceoGroupId) {
    console.warn("[ceo-channel] CEO channel not configured — skipping post");
    return;
  }
  await bot.telegram.sendMessage(ceoGroupId, message, { parse_mode: "HTML" });
}

/**
 * Post a daily summary to the CEO channel.
 */
export async function postDailySummary(summary: string): Promise<void> {
  await postToCeo(summary);
}

/**
 * Post a weekly summary to the CEO channel.
 */
export async function postWeeklySummary(summary: string): Promise<void> {
  await postToCeo(summary);
}

/**
 * Post a real-time strategic flag to the CEO channel.
 */
export async function postCeoFlag(flag: string): Promise<void> {
  await postToCeo(`🚩 ${flag}`);
}
