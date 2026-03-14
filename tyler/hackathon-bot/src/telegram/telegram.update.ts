import { Update, Ctx, Start, Command, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { TelegramService } from './telegram.service';
import { SeedService } from '../database/seed.service';

/** Strip markdown formatting that Telegram doesn't render reliably in group chats */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1')      // **bold**
    .replace(/\*(.+?)\*/gs, '$1')           // *bold/italic*
    .replace(/__(.+?)__/gs, '$1')           // __bold__
    .replace(/_([^_\n]+)_/g, '$1')          // _italic_
    .replace(/```[\s\S]*?```/g, (m) =>      // ```code block``` — keep content, strip fences
      m.replace(/```[^\n]*\n?/, '').replace(/\n?```$/, ''))
    .replace(/`([^`]+)`/g, '$1')            // `inline code`
    .replace(/^#{1,6}\s+/gm, '')            // # headers
    .replace(/^\s*[-*+]\s+/gm, '• ')        // - list items → bullet
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')     // [links](url)
    .trim();
}

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  /** Prevent concurrent processing of messages from the same chat */
  private processingChats: Set<string> = new Set();

  constructor(
    private agent: AgentService,
    private telegram: TelegramService,
    private seed: SeedService,
  ) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply('Shamrock Plumbing Dispatch — Online and ready.');
    const schedule = await this.telegram.postSchedule();
    await ctx.reply(schedule);
  }

  @Command('schedule')
  async scheduleCommand(@Ctx() ctx: Context) {
    const schedule = await this.telegram.postSchedule();
    await ctx.reply(schedule);
  }

  @Command('reset')
  async resetCommand(@Ctx() ctx: Context) {
    await ctx.reply('Resetting to clean Monday morning state...');
    await this.seed.resetAndSeed();
    this.agent.clearHistory();
    this.processingChats.clear();
    const schedule = await this.telegram.postSchedule();
    await ctx.reply('Reset complete. Fresh schedule:\n\n' + schedule);
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    if (!message?.text || message.text.startsWith('/')) return;

    const chatId = String(ctx.chat.id);

    // Deduplication: drop message if we're already mid-response for this chat
    if (this.processingChats.has(chatId)) {
      this.logger.log(`[dedup] Dropping message from ${chatId} — response already in flight`);
      return;
    }

    const channelType = this.telegram.resolveChannel(chatId);
    const senderName = message.from?.first_name || 'User';
    const agentChannel = channelType === 'customer' ? 'customer' : 'ops';

    this.logger.log(`[${channelType}] ${senderName}: ${message.text}`);

    this.processingChats.add(chatId);

    // Show typing indicator and keep it alive while Claude processes
    await ctx.sendChatAction('typing').catch(() => {});
    const typingInterval = setInterval(() => {
      ctx.sendChatAction('typing').catch(() => {});
    }, 4000);

    try {
      const result = await this.agent.chat(
        chatId,
        agentChannel,
        `[${senderName}]: ${message.text}`,
      );

      if (result.emergencyAlert) {
        this.logger.log(`Emergency classified: ${result.emergencyAlert.severity} — posting ops alert`);
        await this.telegram.postEmergencyAlert(result.emergencyAlert);
      }

      await ctx.reply(stripMarkdown(result.response));
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
      await ctx.reply('Sorry, I ran into an issue. Please try again.');
    } finally {
      clearInterval(typingInterval);
      this.processingChats.delete(chatId);
    }
  }
}
