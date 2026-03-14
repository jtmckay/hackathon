import type { Context } from 'telegraf';
import { chat } from '../agent/claude.js';
import { parseDirectives } from '../agent/directives.js';
import { applyStateUpdate, getTechs, getCustomers, getSchedule, createReminder, type ChannelId, type Reminder } from '../agent/state.js';
import { postToCustomer, postToOps } from './groups.js';
import { postToTech } from './tech-channels.js';
import { postToCeo } from './ceo-channel.js';
import { createReminderFromDirective } from '../agent/reminders.js';

export async function handleMessage(
  ctx: Context,
  channel: ChannelId,
): Promise<void> {
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
  if (!text) return;

  const senderName = ctx.from?.first_name || 'Unknown';

  // Enrich message with metadata
  const enrichedMessage = enrichMessage(text, senderName, channel);

  try {
    const rawResponse = await chat(channel, enrichedMessage);
    const parsed = parseDirectives(rawResponse);

    // Send visible response to originating group
    if (parsed.visibleText) {
      await ctx.reply(parsed.visibleText);
    }

    // Execute side-effect directives
    for (const msg of parsed.opsMessages) {
      await postToOps(msg);
    }

    for (const msg of parsed.customerMessages) {
      await postToCustomer(msg);
    }

    for (const msg of parsed.ceoMessages) {
      await postToCeo(msg);
    }

    for (const techMsg of parsed.techMessages) {
      await postToTech(techMsg.techId, techMsg.message);
    }

    for (const update of parsed.stateUpdates) {
      try {
        applyStateUpdate(update);
      } catch (err) {
        console.error('Failed to apply state update:', update, err);
      }
    }

    for (const reminderDir of parsed.reminderDirectives) {
      try {
        createReminderFromDirective(reminderDir);
      } catch (err) {
        console.error('Failed to create reminder:', reminderDir, err);
      }
    }
  } catch (err) {
    console.error('Error handling message:', err);

    if (channel === 'customer') {
      await ctx.reply(
        "We're having a technical issue — please call us at (801) 555-0199 and we'll get you taken care of right away.",
      );
    } else {
      const detail = err instanceof Error ? err.message : String(err);
      await ctx.reply(`API error: ${detail}`);
    }
  }
}

export function enrichMessage(
  text: string,
  senderName: string,
  channel: ChannelId,
): string {
  // Tech channel — attach tech identity and current assignment
  if (channel.startsWith('tech:')) {
    const techId = channel.substring(5);
    const techs = getTechs();
    const tech = techs.find((t) => t.id === techId);
    const techName = tech?.name || capitalize(techId);

    if (tech?.currentJobId) {
      const schedule = getSchedule();
      const customers = getCustomers();
      const currentJob = schedule.jobs.find(
        (j) => String(j.id) === String(tech.currentJobId),
      );
      if (currentJob) {
        const customer = customers.find((c) => c.id === currentJob.customerId);
        return `[Tech ${techName}, currently on ${currentJob.type} for ${customer?.name || currentJob.customerId} at ${currentJob.address}]: ${text}`;
      }
    }

    return `[Tech ${techName}]: ${text}`;
  }

  // CEO channel
  if (channel === 'ceo') {
    return `[CEO - ${senderName}]: ${text}`;
  }

  if (channel === 'ops') {
    // Check if sender matches a tech name
    const techs = getTechs();
    const matchedTech = techs.find(
      (t) => t.name.toLowerCase() === senderName.toLowerCase(),
    );

    if (matchedTech) {
      return `Tech ${matchedTech.name} says: ${text}`;
    }

    return `[Ops - ${senderName}]: ${text}`;
  }

  // Customer group — check if sender matches a known customer
  const customers = getCustomers();
  const matchedCustomer = customers.find((c) => {
    const nameParts = c.name.split(' ');
    const lastName = nameParts[nameParts.length - 1]?.toLowerCase();
    const firstName = nameParts[0]?.toLowerCase();
    return (
      senderName.toLowerCase() === lastName ||
      senderName.toLowerCase() === firstName ||
      senderName.toLowerCase() === c.name.toLowerCase()
    );
  });

  if (matchedCustomer) {
    const complaintCount = matchedCustomer.complaintHistory?.length ?? 0;
    const complaints = complaintCount > 0
      ? `, ${complaintCount} prior complaints`
      : '';
    const recentWork = matchedCustomer.lastJobDate && matchedCustomer.lastJobType
      ? `, last job: ${matchedCustomer.lastJobType} on ${matchedCustomer.lastJobDate}`
      : '';
    return `[Customer: ${matchedCustomer.name}, Tier ${matchedCustomer.tier}, ${matchedCustomer.jobCount} jobs, lifetime value $${matchedCustomer.lifetimeValue}${complaints}${recentWork}]: ${text}`;
  }

  return `[Customer - ${senderName}]: ${text}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
