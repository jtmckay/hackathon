import type { Telegraf } from "telegraf";

export interface OpsMessage {
  title: string;
  body: string;
  reasoning?: string;
  schedule?: string;
  action?: string;
}

let bot: Telegraf | null = null;
let customerGroupId: string | number = "";
let opsGroupId: string | number = "";

/**
 * Initialize the group manager with the bot instance and group IDs.
 * Must be called before any posting methods.
 */
export function initGroups(
  telegrafBot: Telegraf,
  customerGroup: string | number,
  opsGroup: string | number,
): void {
  bot = telegrafBot;
  customerGroupId = customerGroup;
  opsGroupId = opsGroup;
}

/**
 * Send a plain, warm message to the customer group.
 */
export async function postToCustomer(message: string): Promise<void> {
  if (!bot) throw new Error("Group manager not initialized");
  await bot.telegram.sendMessage(customerGroupId, message);
}

/**
 * Send a message to the ops group.
 */
export async function postToOps(message: string): Promise<void> {
  if (!bot) throw new Error("Group manager not initialized");
  await bot.telegram.sendMessage(opsGroupId, message, { parse_mode: "HTML" });
}

/**
 * Send a structured ops message with sections using HTML formatting.
 */
export async function postToOpsFormatted(sections: OpsMessage): Promise<void> {
  if (!bot) throw new Error("Group manager not initialized");

  const parts: string[] = [];
  parts.push(`<b>== ${sections.title} ==</b>`);
  parts.push("");
  parts.push(sections.body);

  if (sections.reasoning) {
    parts.push("");
    parts.push("<b>Reasoning:</b>");
    parts.push(`<pre>${escapeHtml(sections.reasoning)}</pre>`);
  }

  if (sections.schedule) {
    parts.push("");
    parts.push("<b>Schedule:</b>");
    parts.push(`<pre>${escapeHtml(sections.schedule)}</pre>`);
  }

  if (sections.action) {
    parts.push("");
    parts.push(`<b>Action:</b> ${sections.action}`);
  }

  await bot.telegram.sendMessage(opsGroupId, parts.join("\n"), {
    parse_mode: "HTML",
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
