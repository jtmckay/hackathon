import { Update, Ctx, Start, Command, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { TelegramService } from './telegram.service';
import { SeedService } from '../database/seed.service';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private agent: AgentService,
    private telegram: TelegramService,
    private seed: SeedService,
  ) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply('🔧 Shamrock Plumbing Dispatch — Online and ready.');
    const schedule = await this.telegram.postSchedule();
    await ctx.reply(schedule, { parse_mode: 'Markdown' });
  }

  @Command('schedule')
  async scheduleCommand(@Ctx() ctx: Context) {
    const schedule = await this.telegram.postSchedule();
    await ctx.reply(schedule, { parse_mode: 'Markdown' });
  }

  @Command('reset')
  async resetCommand(@Ctx() ctx: Context) {
    await ctx.reply('♻️ Resetting to clean Monday morning state...');
    await this.seed.resetAndSeed();
    this.agent.clearHistory();
    const schedule = await this.telegram.postSchedule();
    await ctx.reply('✅ Reset complete. Fresh schedule:\n\n' + schedule, { parse_mode: 'Markdown' });
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    if (!message?.text || message.text.startsWith('/')) return;

    const chatId = String(ctx.chat.id);
    const channelType = this.telegram.resolveChannel(chatId);
    const senderName = message.from?.first_name || 'User';

    // In unified mode, use 'ops' prompt since the group has both roles
    const agentChannel = channelType === 'customer' ? 'customer' : 'ops';

    this.logger.log(`[${channelType}] ${senderName}: ${message.text}`);

    try {
      const response = await this.agent.chat(
        chatId,
        agentChannel,
        `[${senderName}]: ${message.text}`,
      );
      await ctx.reply(response);
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
      await ctx.reply('Sorry, I ran into an issue processing that. Please try again.');
    }
  }
}
