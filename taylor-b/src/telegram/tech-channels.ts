import type { Telegraf, Context } from 'telegraf';

export interface TechChannel {
  techId: string;
  groupId: string;
}

export interface TechMessage {
  title: string;
  body: string;
  customerNotes?: string;
  propertyNotes?: string;
  driveTime?: string;
  action?: string;
}

const TECH_ENV_MAP: Record<string, string> = {
  TELEGRAM_TECH_GROUP_MARCUS: 'marcus',
  TELEGRAM_TECH_GROUP_TYLER: 'tyler',
  TELEGRAM_TECH_GROUP_JAKE: 'jake',
  TELEGRAM_TECH_GROUP_DANNY: 'danny',
};

let bot: Telegraf<Context>;
const channels: TechChannel[] = [];
const groupToTech = new Map<string, string>();
const techToGroup = new Map<string, string>();

/**
 * Initialize tech channels from environment variables.
 * Call after bot is created, before launching.
 */
export function initTechChannels(telegrafBot: Telegraf<Context>): void {
  bot = telegrafBot;
  channels.length = 0;
  groupToTech.clear();
  techToGroup.clear();

  for (const [envKey, techId] of Object.entries(TECH_ENV_MAP)) {
    const groupId = process.env[envKey];
    if (groupId) {
      channels.push({ techId, groupId });
      groupToTech.set(groupId, techId);
      techToGroup.set(techId, groupId);
    }
  }

  if (channels.length > 0) {
    const names = channels.map((c) => capitalize(c.techId));
    console.log(`Connected to tech channel: ${names.join(', ')}`);
  }
}

/** Resolve which tech a message is from based on the group ID. */
export function getTechByGroupId(groupId: string): string | null {
  return groupToTech.get(groupId) ?? null;
}

/** Find the right group to send a message to a specific tech. */
export function getGroupIdByTech(techId: string): string | null {
  return techToGroup.get(techId) ?? null;
}

/** Check if a group ID belongs to a tech channel. */
export function isTechGroup(groupId: string): boolean {
  return groupToTech.has(groupId);
}

/** Get all registered tech channels. */
export function getAllTechChannels(): TechChannel[] {
  return [...channels];
}

/** Send a plain text message to a specific tech's channel. */
export async function postToTech(techId: string, message: string): Promise<void> {
  const groupId = techToGroup.get(techId);
  if (!groupId) {
    console.warn(`No tech channel configured for ${techId}`);
    return;
  }
  await bot.telegram.sendMessage(groupId, message);
}

/** Send a structured dispatch message to a specific tech's channel. */
export async function postToTechFormatted(
  techId: string,
  sections: TechMessage,
): Promise<void> {
  const parts: string[] = [];

  parts.push(sections.title);
  parts.push('');
  parts.push(sections.body);

  if (sections.customerNotes) {
    parts.push('');
    parts.push(`Customer notes: ${sections.customerNotes}`);
  }

  if (sections.propertyNotes) {
    parts.push(`Property notes: ${sections.propertyNotes}`);
  }

  if (sections.driveTime) {
    parts.push('');
    parts.push(`Drive time from your location: ${sections.driveTime}`);
  }

  if (sections.action) {
    parts.push('');
    parts.push(sections.action);
  }

  await postToTech(techId, parts.join('\n'));
}

/** Send a message to all tech channels (e.g., weather delay). */
export async function broadcastToAllTechs(message: string): Promise<void> {
  for (const channel of channels) {
    await postToTech(channel.techId, message);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
