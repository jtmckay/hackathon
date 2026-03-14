import {
  getDueReminders,
  triggerReminder,
  createReminder,
  getReminders,
  type Reminder,
} from './state.js';
import { postToCustomer, postToOps } from '../telegram/groups.js';
import { postToTech } from '../telegram/tech-channels.js';
import { postToCeo } from '../telegram/ceo-channel.js';

/**
 * Process all due reminders: deliver messages to appropriate channels
 * and advance/trigger each reminder.
 */
export async function processDueReminders(): Promise<number> {
  const due = getDueReminders();
  if (due.length === 0) return 0;

  for (const reminder of due) {
    try {
      await deliverReminder(reminder);
      triggerReminder(reminder.id);
    } catch (err) {
      console.error(`Failed to deliver reminder ${reminder.id}:`, err);
    }
  }

  return due.length;
}

async function deliverReminder(reminder: Reminder): Promise<void> {
  switch (reminder.targetChannel) {
    case 'customer':
      await postToCustomer(reminder.message);
      break;
    case 'ops':
      await postToOps(reminder.message);
      break;
    case 'tech':
      if (reminder.targetId) {
        await postToTech(reminder.targetId, reminder.message);
      }
      break;
    case 'ceo':
      await postToCeo(reminder.message);
      break;
  }
}

/**
 * Create a reminder from a directive parsed out of Claude's response.
 */
export function createReminderFromDirective(directive: {
  createdBy: { role: string; id: string };
  targetChannel: string;
  targetId?: string;
  triggerAt: string;
  recurrence?: { interval: string; customDays?: number; endAfter?: string };
  message: string;
  context: string;
  customerId?: string;
  jobId?: string;
}): Reminder {
  const reminder: Reminder = {
    id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    createdBy: directive.createdBy as Reminder['createdBy'],
    targetChannel: directive.targetChannel as Reminder['targetChannel'],
    targetId: directive.targetId,
    triggerAt: directive.triggerAt,
    recurrence: directive.recurrence as Reminder['recurrence'],
    message: directive.message,
    context: directive.context,
    status: 'active',
    customerId: directive.customerId,
    jobId: directive.jobId,
  };
  createReminder(reminder);
  return reminder;
}

/**
 * Build a summary of upcoming reminders for inclusion in morning briefings.
 */
export function buildReminderBriefing(): string {
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + 7);

  const active = getReminders({ status: 'active' });
  const upcoming = active.filter(
    (r) => r.triggerAt <= endOfWeek.toISOString(),
  );

  if (upcoming.length === 0) return '';

  // Split into today and rest of week
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const today = upcoming.filter((r) => r.triggerAt <= todayEnd.toISOString());
  const thisWeek = upcoming.filter((r) => r.triggerAt > todayEnd.toISOString());

  const lines: string[] = [];
  lines.push('REMINDERS:');

  if (today.length > 0) {
    lines.push(`  Due today (${today.length}):`);
    for (const r of today) {
      const target = r.customerId ? ` [${r.customerId}]` : '';
      lines.push(`    • ${r.message.substring(0, 80)}...${target}`);
    }
  }
  if (thisWeek.length > 0) {
    lines.push(`  This week (${thisWeek.length}):`);
    for (const r of thisWeek) {
      const date = new Date(r.triggerAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const target = r.customerId ? ` [${r.customerId}]` : '';
      lines.push(`    • ${date}: ${r.message.substring(0, 60)}...${target}`);
    }
  }

  return lines.join('\n');
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start a periodic check for due reminders.
 * Checks every 5 minutes by default.
 */
export function startReminderLoop(intervalMs = 5 * 60 * 1000): void {
  if (reminderInterval) return;
  reminderInterval = setInterval(async () => {
    try {
      const count = await processDueReminders();
      if (count > 0) {
        console.log(`Processed ${count} due reminder(s)`);
      }
    } catch (err) {
      console.error('Reminder loop error:', err);
    }
  }, intervalMs);
  console.log('Reminder loop started (checking every 5 minutes)');
}

export function stopReminderLoop(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
