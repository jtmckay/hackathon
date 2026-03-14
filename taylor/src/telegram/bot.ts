import { Telegraf } from "telegraf";
import { initClaudeClient } from "../agent/claude-client.js";
import { clearHistory, clearAllTechHistories } from "../agent/conversation.js";
import { resetToDefault } from "../state/state.js";
import { initGroups, postToOps } from "./groups.js";
import { initTechChannels, getTechByGroupId, getTechGroupIds } from "./tech-channels.js";
import { initCeoChannel, getCeoGroupId, isCeoChannelConfigured, postToCeo } from "./ceo-channel.js";
import { handleMessage } from "./handler.js";
import { postMorningBriefing, generateDailyCeoSummary, generateWeeklyCeoSummary, generateScheduleView } from "./startup.js";
import { processAndDeliverDueReminders } from "./handler.js";

/**
 * Start the Telegram bot with three-channel architecture.
 * Customer group messages → "customer" Claude conversation.
 * Ops group messages → "ops" Claude conversation.
 * Tech group messages → "tech:{techId}" Claude conversation.
 */
export async function startBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set in environment");
  }

  const customerGroupId = process.env.TELEGRAM_CUSTOMER_GROUP_ID;
  const opsGroupId = process.env.TELEGRAM_OPS_GROUP_ID;
  if (!customerGroupId || !opsGroupId) {
    throw new Error(
      "TELEGRAM_CUSTOMER_GROUP_ID and TELEGRAM_OPS_GROUP_ID must be set in environment",
    );
  }

  // Initialize Claude client
  initClaudeClient();

  // Create bot
  const bot = new Telegraf(token);

  // Initialize group manager
  initGroups(bot, customerGroupId, opsGroupId);

  // Initialize tech channels from environment
  initTechChannels(bot);

  // Initialize CEO channel (optional)
  const ceoGroupId = process.env.TELEGRAM_CEO_GROUP_ID;
  if (ceoGroupId) {
    initCeoChannel(bot, ceoGroupId);
  }

  // Handle /morning command in ops group
  bot.command("morning", async (ctx) => {
    const chatId = String(ctx.chat.id);
    if (chatId === String(opsGroupId)) {
      try {
        await postMorningBriefing();
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        await ctx.reply(`Failed to generate morning briefing: ${detail}`);
      }
    }
  });

  // Handle /reset command in ops group — demo reset
  bot.command("reset", async (ctx) => {
    const chatId = String(ctx.chat.id);
    if (chatId === String(opsGroupId)) {
      try {
        resetToDefault();
        clearHistory("customer");
        clearHistory("ops");
        clearHistory("ceo");
        clearAllTechHistories();
        await postToOps("🔄 System reset to clean Monday morning state. Ready for demo.");
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        await ctx.reply(`Failed to reset: ${detail}`);
      }
    }
  });

  // Handle /schedule command — show current schedule state (ops or CEO group)
  bot.command("schedule", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const isOps = chatId === String(opsGroupId);
    const isCeo = isCeoChannelConfigured() && chatId === getCeoGroupId();
    if (isOps || isCeo) {
      try {
        const view = generateScheduleView();
        await ctx.reply(view);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        await ctx.reply(`Failed to generate schedule: ${detail}`);
      }
    }
  });

  // Handle /summary command — daily or weekly CEO summary (ops or CEO group)
  // Usage: /summary daily, /summary weekly (defaults to daily)
  bot.command("summary", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const isOps = chatId === String(opsGroupId);
    const isCeo = isCeoChannelConfigured() && chatId === getCeoGroupId();
    if (isOps || isCeo) {
      try {
        const arg = ctx.message.text.split(/\s+/)[1]?.toLowerCase();
        const summary = arg === "weekly"
          ? generateWeeklyCeoSummary()
          : generateDailyCeoSummary();
        if (isCeoChannelConfigured()) {
          await postToCeo(summary);
        }
        if (isOps) {
          await ctx.reply(summary);
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        await ctx.reply(`Failed to generate summary: ${detail}`);
      }
    }
  });

  // Handle all text messages — route to the appropriate channel
  bot.on("text", async (ctx) => {
    const chatId = String(ctx.chat.id);

    if (chatId === String(customerGroupId)) {
      await handleMessage(ctx, "customer", customerGroupId, opsGroupId);
    } else if (chatId === String(opsGroupId)) {
      await handleMessage(ctx, "ops", customerGroupId, opsGroupId);
    } else if (isCeoChannelConfigured() && chatId === getCeoGroupId()) {
      await handleMessage(ctx, "ceo", customerGroupId, opsGroupId);
    } else {
      // Check if this is a tech channel
      const techId = getTechByGroupId(chatId);
      if (techId) {
        await handleMessage(ctx, `tech:${techId}`, customerGroupId, opsGroupId);
      }
      // Ignore messages from unknown chats
    }
  });

  // Error handling
  bot.catch((err) => {
    console.error("[bot] Unhandled error:", err);
  });

  // Launch
  await bot.launch();
  console.log("Shamrock Plumbing bot is live");

  // Post morning briefing on startup
  try {
    await postMorningBriefing();
  } catch (err) {
    console.error("[bot] Failed to post morning briefing on startup:", err);
  }

  // Process any due reminders on startup
  try {
    await processAndDeliverDueReminders();
  } catch (err) {
    console.error("[bot] Failed to process due reminders on startup:", err);
  }

  // Check for due reminders every 5 minutes
  const reminderInterval = setInterval(async () => {
    try {
      await processAndDeliverDueReminders();
    } catch (err) {
      console.error("[bot] Reminder check failed:", err);
    }
  }, 5 * 60 * 1000);

  // Graceful shutdown
  process.once("SIGINT", () => {
    clearInterval(reminderInterval);
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    clearInterval(reminderInterval);
    bot.stop("SIGTERM");
  });
}
