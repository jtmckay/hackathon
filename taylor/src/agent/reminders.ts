import {
  getDueReminders,
  triggerReminder,
  createReminder,
  getReminders,
} from "../state/state.js";
import type { Reminder, ReminderTargetChannel } from "../types.js";
import type { ReminderDirective } from "./directives.js";

/**
 * Process a CREATE_REMINDER directive from Claude's response.
 * Converts the directive into a full Reminder and stores it.
 */
export function processReminderDirective(directive: ReminderDirective): Reminder {
  const reminder: Reminder = {
    id: directive.id || `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    createdBy: {
      role: (directive.createdByRole as Reminder["createdBy"]["role"]) ?? "system",
      id: directive.createdById ?? "system",
    },
    targetChannel: directive.targetChannel as ReminderTargetChannel,
    targetId: directive.targetId,
    triggerAt: directive.triggerAt,
    recurrence: directive.recurrence as Reminder["recurrence"],
    message: directive.message,
    context: directive.context,
    status: "active",
    customerId: directive.customerId,
    jobId: directive.jobId,
  };

  createReminder(reminder);
  console.log(`[reminders] Created reminder ${reminder.id} → triggers at ${reminder.triggerAt}`);
  return reminder;
}

/**
 * Check for and return all due reminders. Does NOT trigger them —
 * the caller is responsible for delivering the message and then calling triggerReminder().
 */
export function checkDueReminders(asOf?: string): Reminder[] {
  return getDueReminders(asOf);
}

/**
 * Mark a reminder as triggered and advance recurrence if applicable.
 */
export function markTriggered(reminderId: string): void {
  triggerReminder(reminderId);
  console.log(`[reminders] Triggered reminder ${reminderId}`);
}

/**
 * Get a human-readable summary of upcoming reminders for inclusion
 * in morning briefings or CEO reports.
 */
export function getUpcomingRemindersSummary(daysAhead: number = 7): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const upcoming = getReminders({
    status: "active",
    beforeDate: cutoff.toISOString(),
  }).sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));

  if (upcoming.length === 0) {
    return "No reminders scheduled in the next " + daysAhead + " days.";
  }

  const lines: string[] = [];
  lines.push(`UPCOMING REMINDERS (next ${daysAhead} days):`);
  for (const r of upcoming) {
    const date = r.triggerAt.split("T")[0];
    const target = r.targetId ?? r.targetChannel;
    lines.push(`  ${date} → ${target}: ${r.message.slice(0, 100)}${r.message.length > 100 ? "..." : ""}`);
  }
  return lines.join("\n");
}

/**
 * Get a summary of all active reminders (for ops/CEO queries).
 */
export function getActiveRemindersSummary(): string {
  const active = getReminders({ status: "active" });

  if (active.length === 0) {
    return "No active reminders.";
  }

  const byChannel: Record<string, number> = {};
  for (const r of active) {
    byChannel[r.targetChannel] = (byChannel[r.targetChannel] ?? 0) + 1;
  }

  const lines: string[] = [];
  lines.push(`${active.length} active reminders:`);
  for (const [channel, count] of Object.entries(byChannel)) {
    lines.push(`  ${channel}: ${count}`);
  }
  return lines.join("\n");
}
