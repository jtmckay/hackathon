import type { Telegraf, Context } from 'telegraf';

export interface OpsMessage {
  title: string;
  body: string;
  reasoning?: string;
  schedule?: string;
  action?: string;
}

let bot: Telegraf<Context>;
let customerGroupId: string;
let opsGroupId: string;

export function initGroups(
  telegrafBot: Telegraf<Context>,
  customerGroup: string,
  opsGroup: string,
): void {
  bot = telegrafBot;
  customerGroupId = customerGroup;
  opsGroupId = opsGroup;
}

export async function postToCustomer(message: string): Promise<void> {
  await bot.telegram.sendMessage(customerGroupId, message);
}

export async function postToOps(message: string): Promise<void> {
  await bot.telegram.sendMessage(opsGroupId, message, { parse_mode: 'HTML' });
}

export async function postToOpsFormatted(sections: OpsMessage): Promise<void> {
  const parts: string[] = [];

  parts.push(`<b>${escapeHtml(sections.title)}</b>`);
  parts.push('');
  parts.push(escapeHtml(sections.body));

  if (sections.reasoning) {
    parts.push('');
    parts.push('<b>Reasoning:</b>');
    parts.push(`<blockquote>${escapeHtml(sections.reasoning)}</blockquote>`);
  }

  if (sections.schedule) {
    parts.push('');
    parts.push('<b>Schedule:</b>');
    parts.push(`<pre>${escapeHtml(sections.schedule)}</pre>`);
  }

  if (sections.action) {
    parts.push('');
    parts.push(`<b>Action:</b> ${escapeHtml(sections.action)}`);
  }

  await bot.telegram.sendMessage(opsGroupId, parts.join('\n'), {
    parse_mode: 'HTML',
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
