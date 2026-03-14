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

  async postDispatchDecision(
    decision: {
      selectedTechName: string;
      selectionReason: string;
      estimatedDriveMinutes: number;
      consideredTechs: { techName: string; accepted: boolean; reason: string }[];
      issueDescription: string;
      customerName: string;
    },
    displacedJobs: { type: string; customerName: string; time: string }[],
  ): Promise<void> {
    const consideredLines = decision.consideredTechs
      .map(t => `  ${t.accepted ? '✓' : '✗'} ${t.techName} — ${t.reason}`)
      .join('\n');

    const displacedLines = displacedJobs.length > 0
      ? displacedJobs.map(j => `  ${j.type} @ ${j.customerName} (${j.time}) — needs rescheduling`).join('\n')
      : '  None';

    const lines = [
      '📋 DISPATCH DECISION',
      '',
      `SENDING: ${decision.selectedTechName}`,
      `REASON: ${decision.selectionReason}`,
      `ETA to scene: ~${decision.estimatedDriveMinutes} min`,
      '',
      'CONSIDERED:',
      consideredLines,
      '',
      'DISPLACED JOBS:',
      displacedLines,
    ];

    await this.sendToOps(lines.join('\n'));
    this.logger.log(`Dispatch decision posted: ${decision.selectedTechName}`);
  }

  async postDispatchOrder(decision: {
    selectedTechName: string;
    customerName: string;
    emergencyAddress: string;
    issueDescription: string;
    safetyConcerns: string;
    estimatedDriveMinutes: number;
  }): Promise<void> {
    const lines = [
      `DISPATCH ORDER — ${decision.selectedTechName.toUpperCase()}`,
      '',
      `Customer: ${decision.customerName}`,
      `Address: ${decision.emergencyAddress}`,
      `Issue: ${decision.issueDescription}`,
      `Safety: ${decision.safetyConcerns || 'none'}`,
      `ETA target: ~${decision.estimatedDriveMinutes} min`,
      '',
      'Your current job has been paused. Head to this address immediately.',
      'Call the customer when 5 minutes away.',
    ];

    await this.sendToOps(lines.join('\n'));
  }

  async postEscalation(data: {
    reason: string;
    consideredTechs: { techName: string; excludedReason: string }[];
  }): Promise<void> {
    const techLines = data.consideredTechs
      .map(t => `  ${t.techName} — ${t.excludedReason}`)
      .join('\n');

    const lines = [
      '⚠️ ALL TECHS UNAVAILABLE — ESCALATING TO BLAKE',
      '',
      `Reason: ${data.reason}`,
      '',
      'Techs evaluated:',
      techLines,
    ];

    await this.sendToOps(lines.join('\n'));
    this.logger.log('Escalation posted to ops channel');
  }

  async postScheduleRebuild(
    trigger: string,
    affectedTechName: string,
    decisions: { customerName: string; action: string; reassignToTechName?: string; newTime?: string; newDay?: string; jobType: string }[],
  ): Promise<void> {
    const triggerLabel =
      trigger === 'tech_sick' ? `${affectedTechName} called in sick` :
      trigger === 'job_overrun' ? `${affectedTechName} job running long` :
      `${affectedTechName} pulled for emergency`;

    const decisionLines = decisions.map(d => {
      if (d.action === 'reassign') {
        return `  Reassigned: ${d.jobType} @ ${d.customerName} → ${d.reassignToTechName} at ${d.newTime}`;
      }
      return `  Rescheduled: ${d.jobType} @ ${d.customerName} → ${d.newDay ?? 'next available'}`;
    });

    const lines = [
      '📅 SCHEDULE UPDATE',
      `Trigger: ${triggerLabel}`,
      '',
      'Cascade decisions:',
      ...decisionLines,
      '',
      'All affected customers notified.',
    ];

    await this.sendToOps(lines.join('\n'));
  }

  async postBlakeBriefing(data: {
    trigger: string;
    affectedTechName: string;
    decisionsCount: number;
    reassigned: number;
    rescheduled: number;
    customerNotifications: string[];
  }): Promise<void> {
    const lines = [
      'BLAKE BRIEFING',
      '',
      `What happened: ${data.trigger}`,
      `Tech affected: ${data.affectedTechName}`,
      `Jobs handled: ${data.decisionsCount} total (${data.reassigned} reassigned today, ${data.rescheduled} rescheduled)`,
      '',
      'Customer notifications sent:',
      ...data.customerNotifications.map(n => `  ${n}`),
      '',
      'Schedule is stable. No action needed unless noted above.',
    ];

    await this.sendToOps(lines.join('\n'));
  }

  async postCallbackAlert(data: {
    customerName: string;
    recentJobDescription: string;
    currentIssue: string;
  }): Promise<void> {
    const lines = [
      '⚠️ POSSIBLE CALLBACK',
      `Customer: ${data.customerName}`,
      `Recent work: ${data.recentJobDescription}`,
      `Now reporting: ${data.currentIssue}`,
      'Action: Offer to fix at no charge per warranty policy. Assign original tech if possible.',
    ];

    await this.sendToOps(lines.join('\n'));
    this.logger.log(`Callback alert: ${data.customerName}`);
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
