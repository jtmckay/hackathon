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

  resolveChannel(chatId: string): 'ops' | 'customer' | 'unified' {
    if (!this.multiChannelEnabled) return 'unified';
    if (chatId === this.opsChannelId) return 'ops';
    if (chatId === this.customerChannelId) return 'customer';
    return 'unified';
  }

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
    await this.bot.telegram.sendMessage(this.groupChatId, message);
  }

  async sendToOps(message: string) {
    if (this.multiChannelEnabled && this.opsChannelId) {
      await this.bot.telegram.sendMessage(this.opsChannelId, message);
    } else {
      await this.sendToGroup(message);
    }
  }

  async sendToCustomer(message: string) {
    if (this.multiChannelEnabled && this.customerChannelId) {
      await this.bot.telegram.sendMessage(this.customerChannelId, message);
    } else {
      await this.sendToGroup(message);
    }
  }

  async postEmergencyAlert(data: {
    severity: 'Critical' | 'Urgent';
    customerName: string;
    customerTier: string;
    customerSince: string;
    address: string;
    isNewCustomer: boolean;
    issue: string;
    safetyConcerns: string;
  }): Promise<void> {
    const customerLabel = data.isNewCustomer
      ? `${data.customerName} (NEW)`
      : `${data.customerName} (${data.customerTier} — customer since ${data.customerSince})`;

    const lines = [
      '🚨 EMERGENCY INCOMING',
      `Severity: ${data.severity}`,
      `Customer: ${customerLabel}`,
      `Address: ${data.address || 'Collecting...'}`,
      `Issue: ${data.issue}`,
      `Safety concerns: ${data.safetyConcerns || 'none'}`,
      `Status: Qualifying — awaiting dispatch decision`,
    ];

    await this.sendToOps(lines.join('\n'));
    this.logger.log(`Emergency alert posted: ${data.severity} — ${data.issue}`);
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

    const lines = ['📋 Today\'s Schedule\n'];
    for (const [techName, techJobs] of Object.entries(grouped)) {
      lines.push(`${techName}:`);
      for (const job of techJobs) {
        const icon =
          job.status === 'scheduled' ? '⏳' :
          job.status === 'in_progress' ? '🔧' :
          job.status === 'completed' ? '✅' : '⚠️';
        lines.push(`  ${icon} ${job.time} — ${job.type} @ ${job.customerName}${job.bumpable ? ' [bumpable]' : ''}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
