import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private prisma: PrismaService,
  ) {}

  get multiChannelEnabled(): boolean {
    return process.env.MULTI_CHANNEL_ENABLED === 'true';
  }

  get groupChatId(): string {
    return process.env.GROUP_CHAT_ID || '';
  }

  get customerChannelId(): string {
    return process.env.CUSTOMER_CHANNEL_ID || '';
  }

  get opsChannelId(): string {
    return process.env.OPS_CHANNEL_ID || '';
  }

  /** Resolve which channel type a chat belongs to */
  resolveChannel(chatId: string): 'ops' | 'customer' | 'unified' {
    if (!this.multiChannelEnabled) return 'unified';
    if (chatId === this.opsChannelId) return 'ops';
    if (chatId === this.customerChannelId) return 'customer';
    return 'unified';
  }

  /** Is this message from a known group/channel? */
  isKnownChat(chatId: string): boolean {
    if (!this.multiChannelEnabled) {
      return chatId === this.groupChatId;
    }
    return chatId === this.customerChannelId || chatId === this.opsChannelId;
  }

  async sendToGroup(message: string) {
    if (!this.groupChatId) {
      this.logger.warn('GROUP_CHAT_ID not set');
      return;
    }
    await this.bot.telegram.sendMessage(this.groupChatId, message, { parse_mode: 'Markdown' });
  }

  async sendToOps(message: string) {
    if (this.multiChannelEnabled && this.opsChannelId) {
      await this.bot.telegram.sendMessage(this.opsChannelId, message, { parse_mode: 'Markdown' });
    } else {
      await this.sendToGroup(message);
    }
  }

  async sendToCustomer(message: string) {
    if (this.multiChannelEnabled && this.customerChannelId) {
      await this.bot.telegram.sendMessage(this.customerChannelId, message, { parse_mode: 'Markdown' });
    } else {
      await this.sendToGroup(message);
    }
  }

  async postSchedule(): Promise<string> {
    const jobs = await this.prisma.scheduledJob.findMany({
      include: { tech: true },
      orderBy: [{ techId: 'asc' }, { time: 'asc' }],
    });

    if (jobs.length === 0) return 'No jobs scheduled for today.';

    const grouped: Record<string, typeof jobs> = {};
    for (const job of jobs) {
      const name = job.tech.name;
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(job);
    }

    const lines = [`📋 *Today's Schedule*\n`];
    for (const [techName, techJobs] of Object.entries(grouped)) {
      lines.push(`*${techName}:*`);
      for (const job of techJobs) {
        const status = job.status === 'scheduled' ? '⏳' : job.status === 'in_progress' ? '🔧' : job.status === 'completed' ? '✅' : '⚠️';
        lines.push(`  ${status} ${job.time} — ${job.type} @ ${job.customerName}${job.bumpable ? ' [bumpable]' : ''}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
