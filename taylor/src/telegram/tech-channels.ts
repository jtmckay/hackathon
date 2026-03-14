import type { Telegraf } from "telegraf";

export interface TechChannel {
  techId: string;
  groupId: string;
}

export interface TechMessage {
  title: string;
  body: string;
  customerNotes?: string;
  driveTime?: string;
  action?: string;
}

/** All known tech IDs in the system */
const TECH_IDS = ["marcus", "tyler", "jake", "danny"] as const;

let bot: Telegraf | null = null;
const channels: TechChannel[] = [];

/**
 * Initialize tech channels from environment variables.
 * Expects TELEGRAM_TECH_GROUP_{NAME} for each tech.
 */
export function initTechChannels(telegrafBot: Telegraf): void {
  bot = telegrafBot;
  channels.length = 0;

  for (const techId of TECH_IDS) {
    const envKey = `TELEGRAM_TECH_GROUP_${techId.toUpperCase()}`;
    const groupId = process.env[envKey];
    if (groupId) {
      channels.push({ techId, groupId });
    }
  }

  if (channels.length > 0) {
    const names = channels.map((c) => c.techId.charAt(0).toUpperCase() + c.techId.slice(1));
    console.log(`Connected to tech channel: ${names.join(", ")}`);
  }
}

/**
 * Get all configured tech channels.
 */
export function getTechChannels(): TechChannel[] {
  return [...channels];
}

/**
 * Get all configured tech group IDs.
 */
export function getTechGroupIds(): string[] {
  return channels.map((c) => c.groupId);
}

/**
 * Resolve which tech a message is from based on the group ID.
 */
export function getTechByGroupId(groupId: string): string | null {
  const channel = channels.find((c) => String(c.groupId) === String(groupId));
  return channel ? channel.techId : null;
}

/**
 * Find the right group to send a message to a specific tech.
 */
export function getGroupIdByTech(techId: string): string | null {
  const channel = channels.find((c) => c.techId === techId.toLowerCase());
  return channel ? channel.groupId : null;
}

/**
 * Send a plain text message to a specific tech's channel.
 */
export async function postToTech(techId: string, message: string): Promise<void> {
  if (!bot) throw new Error("Tech channels not initialized");

  const groupId = getGroupIdByTech(techId);
  if (!groupId) {
    console.warn(`[tech-channels] No channel configured for tech: ${techId}`);
    return;
  }

  await bot.telegram.sendMessage(groupId, message);
}

/**
 * Send a structured dispatch/schedule message to a specific tech's channel.
 */
export async function postToTechFormatted(techId: string, sections: TechMessage): Promise<void> {
  if (!bot) throw new Error("Tech channels not initialized");

  const groupId = getGroupIdByTech(techId);
  if (!groupId) {
    console.warn(`[tech-channels] No channel configured for tech: ${techId}`);
    return;
  }

  const parts: string[] = [];
  parts.push(sections.title);
  parts.push("");
  parts.push(sections.body);

  if (sections.customerNotes) {
    parts.push("");
    parts.push(sections.customerNotes);
  }

  if (sections.driveTime) {
    parts.push("");
    parts.push(`Drive time from your location: ${sections.driveTime}`);
  }

  if (sections.action) {
    parts.push("");
    parts.push(sections.action);
  }

  await bot.telegram.sendMessage(groupId, parts.join("\n"));
}

/**
 * Send a message to all tech channels (rare — e.g., weather delay).
 */
export async function broadcastToAllTechs(message: string): Promise<void> {
  for (const channel of channels) {
    try {
      await postToTech(channel.techId, message);
    } catch (err) {
      console.error(`[tech-channels] Failed to broadcast to ${channel.techId}:`, err);
    }
  }
}
