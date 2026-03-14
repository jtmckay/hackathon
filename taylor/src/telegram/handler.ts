import type { Context } from "telegraf";
import { chat } from "../agent/claude-client.js";
import { parseDirectives, type StateUpdate } from "../agent/directives.js";
import { postToCustomer, postToOps } from "./groups.js";
import { postToTech } from "./tech-channels.js";
import { postToCeo, isCeoChannelConfigured } from "./ceo-channel.js";
import { processReminderDirective, checkDueReminders, markTriggered } from "../agent/reminders.js";
import {
  getTechs,
  getCustomers,
  updateTechStatus,
  updateJobStatus,
  addJobToSchedule,
  reassignJob,
  consumeFlexSlot,
  getJobsByTech,
} from "../state/state.js";
import type { Channel } from "../agent/conversation.js";
import type { TechStatus, JobStatus, ScheduledJob } from "../types.js";

/**
 * Handle an incoming Telegram message: enrich, send to Claude, parse directives,
 * respond, and execute side effects.
 *
 * Supports three channel types: customer, ops, and tech (per-tech channels).
 */
export async function handleMessage(
  ctx: Context,
  channel: Channel,
  customerGroupId: string | number,
  opsGroupId: string | number,
): Promise<void> {
  const text = (ctx.message && "text" in ctx.message) ? ctx.message.text : undefined;
  if (!text) return;

  const senderName =
    ctx.message && "from" in ctx.message
      ? ctx.message.from?.first_name ?? "Unknown"
      : "Unknown";

  try {
    // Enrich the message with context
    const enrichedMessage = enrichMessage(text, senderName, channel);

    // Build metadata for the Claude client
    const metadata = buildMetadata(senderName, channel);

    // Send to Claude
    const rawResponse = await chat(channel, enrichedMessage, metadata);

    // Parse directives from Claude's response
    const parsed = parseDirectives(rawResponse);

    // Send the visible response back to the originating group
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

    // Process reminder directives
    for (const reminderDir of parsed.reminderDirectives) {
      try {
        processReminderDirective(reminderDir);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`[directives] Failed to create reminder:`, detail, reminderDir);
      }
    }

    // Apply state updates from directives
    for (const update of parsed.stateUpdates) {
      try {
        applyStateUpdate(update);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`[directives] Failed to apply state update:`, detail, update);
      }
    }
  } catch (err) {
    console.error("[handler] Error processing message:", err);

    if (channel === "customer") {
      await ctx.reply(
        "We're having a technical issue — please call us at 801-555-0100 and we'll take care of you right away.",
      );
    } else {
      const detail = err instanceof Error ? err.message : String(err);
      await ctx.reply(`API error: ${detail}`);
    }
  }
}

/**
 * Enrich a message with sender context before sending to Claude.
 */
function enrichMessage(
  text: string,
  senderName: string,
  channel: Channel,
): string {
  if (channel === "ops") {
    // Check if sender matches a known tech
    const techs = getTechs();
    const matchedTech = techs.find(
      (t) => t.name.toLowerCase() === senderName.toLowerCase(),
    );
    if (matchedTech) {
      return `Tech ${matchedTech.name} says: ${text}`;
    }
    return `${senderName} says: ${text}`;
  }

  if (channel === "customer") {
    // Check if sender matches a known customer
    const customers = getCustomers();
    const matchedCustomer = customers.find(
      (c) => c.name.toLowerCase() === senderName.toLowerCase(),
    );
    if (matchedCustomer) {
      const context = [
        `Known customer: ${matchedCustomer.name}`,
        `Tier ${matchedCustomer.tier}`,
        `${matchedCustomer.jobCount} previous jobs`,
        `Lifetime value: $${matchedCustomer.lifetimeValue}`,
      ];
      if (matchedCustomer.notes) {
        context.push(`Notes: ${matchedCustomer.notes}`);
      }
      return `[Customer profile: ${context.join(", ")}] ${senderName}: ${text}`;
    }
    return `${senderName}: ${text}`;
  }

  // CEO channel — minimal enrichment, just sender identity
  if (channel === "ceo") {
    return `CEO (${senderName}): ${text}`;
  }

  // Tech channel — enrich with tech identity and current assignment
  if (channel.startsWith("tech:")) {
    const techId = channel.slice(5);
    const techs = getTechs();
    const tech = techs.find((t) => t.id === techId);
    if (tech) {
      const jobs = getJobsByTech(techId);
      const currentJob = jobs.find((j) => j.status === "in_progress");
      const nextJob = jobs
        .filter((j) => j.status === "scheduled")
        .sort((a, b) => a.time.localeCompare(b.time))[0];

      const context: string[] = [
        `Tech: ${tech.name} (${tech.seniority})`,
        `Status: ${tech.status}`,
      ];
      if (currentJob) {
        context.push(`Current job: ${currentJob.type} at ${currentJob.address}`);
      }
      if (nextJob) {
        context.push(`Next job: ${nextJob.type} at ${nextJob.time}`);
      }
      return `[${context.join(", ")}] ${tech.name}: ${text}`;
    }
    return text;
  }

  return text;
}

/**
 * Build metadata for the Claude client based on sender and channel.
 */
function buildMetadata(
  senderName: string,
  channel: Channel,
): { senderContext?: string } {
  if (channel === "ops") {
    const techs = getTechs();
    const matchedTech = techs.find(
      (t) => t.name.toLowerCase() === senderName.toLowerCase(),
    );
    if (matchedTech) {
      return {
        senderContext: `Message from tech ${matchedTech.name} (${matchedTech.seniority}, ${matchedTech.specialties.join(", ")})`,
      };
    }
  }

  if (channel.startsWith("tech:")) {
    const techId = channel.slice(5);
    const techs = getTechs();
    const tech = techs.find((t) => t.id === techId);
    if (tech) {
      return {
        senderContext: `Message from tech ${tech.name} in their dedicated tech channel (${tech.seniority}, ${tech.specialties.join(", ")})`,
      };
    }
  }

  return {};
}

/**
 * Process all due reminders and deliver them to the appropriate channels.
 * Called on startup and periodically by the bot.
 */
export async function processAndDeliverDueReminders(): Promise<void> {
  const dueReminders = checkDueReminders();
  if (dueReminders.length === 0) return;

  console.log(`[reminders] Processing ${dueReminders.length} due reminder(s)`);

  for (const reminder of dueReminders) {
    try {
      switch (reminder.targetChannel) {
        case "customer":
          await postToCustomer(reminder.message);
          break;
        case "ops":
          await postToOps(reminder.message);
          break;
        case "ceo":
          await postToCeo(reminder.message);
          break;
        case "tech":
          if (reminder.targetId) {
            await postToTech(reminder.targetId, reminder.message);
          }
          break;
      }
      markTriggered(reminder.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[reminders] Failed to deliver reminder ${reminder.id}:`, detail);
    }
  }
}

/**
 * Apply a state update directive from Claude's response.
 */
function applyStateUpdate(update: StateUpdate): void {
  const { type, payload } = update;

  switch (type) {
    case "tech_status": {
      const techId = payload.techId as string;
      const status = payload.status as TechStatus;
      const currentJobId = payload.currentJobId as number | null | undefined;
      updateTechStatus(techId, status, currentJobId);
      console.log(`[state] Tech ${techId} → ${status}`);
      break;
    }
    case "job_status": {
      const jobId = payload.jobId as number;
      const status = payload.status as JobStatus;
      updateJobStatus(jobId, status);
      console.log(`[state] Job ${jobId} → ${status}`);
      break;
    }
    case "add_job": {
      const job = payload as unknown as ScheduledJob;
      addJobToSchedule(job);
      console.log(`[state] Added job ${job.id}: ${job.type}`);
      break;
    }
    case "reassign_job": {
      const jobId = payload.jobId as number;
      const newTechId = payload.newTechId as string;
      const newTime = payload.newTime as string | undefined;
      reassignJob(jobId, newTechId, newTime);
      console.log(`[state] Reassigned job ${jobId} → tech ${newTechId}`);
      break;
    }
    case "consume_flex": {
      const slotId = payload.slotId as string;
      consumeFlexSlot(slotId);
      console.log(`[state] Consumed flex slot ${slotId}`);
      break;
    }
    default:
      console.log(`[state] Unknown update type: ${type}`, payload);
  }
}
