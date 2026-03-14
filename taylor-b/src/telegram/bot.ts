import { Telegraf } from 'telegraf';
import { initGroups, postToOps } from './groups.js';
import { initTechChannels, isTechGroup, getTechByGroupId } from './tech-channels.js';
import { initCeoChannel, isCeoGroup, postToCeo, buildDailySummary, buildWeeklySummary } from './ceo-channel.js';
import { handleMessage } from './handler.js';
import { postMorningSchedule } from './startup.js';
import { resetToDefault } from '../agent/state.js';
import { startReminderLoop, stopReminderLoop, processDueReminders } from '../agent/reminders.js';

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const customerGroupId = process.env.TELEGRAM_CUSTOMER_GROUP_ID;
  const opsGroupId = process.env.TELEGRAM_OPS_GROUP_ID;
  const ceoGroupId = process.env.TELEGRAM_CEO_GROUP_ID;

  if (!customerGroupId || !opsGroupId) {
    throw new Error(
      'TELEGRAM_CUSTOMER_GROUP_ID and TELEGRAM_OPS_GROUP_ID are required',
    );
  }

  const bot = new Telegraf(token);

  // Initialize group managers
  initGroups(bot, customerGroupId, opsGroupId);
  initTechChannels(bot);
  initCeoChannel(bot, ceoGroupId);

  // Handle /morning command in ops group
  bot.command('morning', async (ctx) => {
    if (String(ctx.chat.id) === opsGroupId) {
      await postMorningSchedule();
    }
  });

  // Handle /daily command — post daily summary to CEO channel
  bot.command('daily', async (ctx) => {
    const chatId = String(ctx.chat.id);
    if (chatId === opsGroupId || chatId === ceoGroupId) {
      const summary = buildDailySummary();
      await postToCeo(summary);
      if (chatId === opsGroupId) {
        await postToOps('📊 Daily summary posted to CEO channel.');
      }
    }
  });

  // Handle /weekly command — post weekly summary to CEO channel
  bot.command('weekly', async (ctx) => {
    const chatId = String(ctx.chat.id);
    if (chatId === opsGroupId || chatId === ceoGroupId) {
      const summary = buildWeeklySummary();
      await postToCeo(summary);
      if (chatId === opsGroupId) {
        await postToOps('📈 Weekly summary posted to CEO channel.');
      }
    }
  });

  // Handle /reminders command — process due reminders immediately
  bot.command('reminders', async (ctx) => {
    const chatId = String(ctx.chat.id);
    if (chatId === opsGroupId) {
      const count = await processDueReminders();
      await postToOps(`⏰ Processed ${count} due reminder(s).`);
    }
  });

  // Handle /reset command in ops group
  bot.command('reset', async (ctx) => {
    if (String(ctx.chat.id) === opsGroupId) {
      resetToDefault();
      await postToOps('🔄 System reset to clean Monday morning state. Ready for demo.');
    }
  });

  // Handle all text messages
  bot.on('text', async (ctx) => {
    const chatId = String(ctx.chat.id);

    // Skip commands (already handled above)
    if (ctx.message.text.startsWith('/')) return;

    if (chatId === customerGroupId) {
      await handleMessage(ctx, 'customer');
    } else if (chatId === opsGroupId) {
      await handleMessage(ctx, 'ops');
    } else if (ceoGroupId && chatId === ceoGroupId) {
      await handleMessage(ctx, 'ceo');
    } else if (isTechGroup(chatId)) {
      const techId = getTechByGroupId(chatId);
      if (techId) {
        await handleMessage(ctx, `tech:${techId}`);
      }
    }
    // Ignore messages from other chats
  });

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}

export async function startBot(): Promise<void> {
  const bot = createBot();

  // Start reminder processing loop
  startReminderLoop();

  // Process any immediately-due reminders on startup
  const dueCount = await processDueReminders();
  if (dueCount > 0) {
    console.log(`Processed ${dueCount} due reminder(s) on startup`);
  }

  // Graceful stop
  process.once('SIGINT', () => {
    stopReminderLoop();
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    stopReminderLoop();
    bot.stop('SIGTERM');
  });

  await bot.launch();
  console.log('Shamrock Plumbing bot is live');
}
