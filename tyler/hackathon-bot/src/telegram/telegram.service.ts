import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { PrismaService } from '../prisma.service';

export type ChannelType = 'operator' | 'customer' | 'tech' | 'unknown';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private prisma: PrismaService,
  ) {}

  // ─── Channel ID accessors ──────────────────────────────────────────────────

  get multiChannelEnabled(): boolean {
    return process.env.MULTI_CHANNEL_ENABLED === 'true';
  }

  get operatorGroupId(): string {
    return process.env.OPERATOR_GROUP_ID || '';
  }

  get customerGroupId(): string {
    return process.env.CUSTOMER_GROUP_ID || '';
  }

  get techGroupId(): string {
    return process.env.TECH_GROUP_ID || '';
  }

  get groupChatId(): string {
    return process.env.GROUP_CHAT_ID || '';
  }

  // ─── Routing ───────────────────────────────────────────────────────────────

  resolveChannel(chatId: string): ChannelType {
    if (this.multiChannelEnabled) {
      if (chatId === this.operatorGroupId) return 'operator';
      if (chatId === this.customerGroupId) return 'customer';
      if (chatId === this.techGroupId) return 'tech';
      // DMs have positive chat IDs — treat as customer when DMs are enabled
      if (process.env.ALLOW_CUSTOMER_DMS === 'true' && !chatId.startsWith('-')) return 'customer';
      return 'unknown';
    }
    // Single-channel fallback — treat the unified group as operator
    if (chatId === this.groupChatId) return 'operator';
    return 'unknown';
  }

  isKnownChat(chatId: string): boolean {
    return this.resolveChannel(chatId) !== 'unknown';
  }

  // ─── Active DM customer tracking ──────────────────────────────────────────

  /** Chat IDs of DM customers who have sent a message recently — receive customer fan-out */
  private activeDmCustomerIds: Set<string> = new Set();

  registerDmCustomer(chatId: string): void {
    this.activeDmCustomerIds.add(chatId);
  }

  clearDmCustomers(): void {
    this.activeDmCustomerIds.clear();
  }

  // ─── Send helpers ──────────────────────────────────────────────────────────

  /** Guard: never send an empty message to Telegram — logs and skips instead of throwing 400 */
  private safeText(message: string, fallback = '.'): string {
    const stripped = message?.trim();
    if (!stripped) {
      this.logger.warn(`safeText: empty message intercepted — using fallback "${fallback}"`);
      return fallback;
    }
    return stripped;
  }

  async sendToOperator(message: string): Promise<void> {
    const target = this.multiChannelEnabled ? this.operatorGroupId : this.groupChatId;
    if (!target) { this.logger.warn('No operator channel configured'); return; }
    await this.bot.telegram.sendMessage(target, this.safeText(message));
  }

  async sendToCustomer(message: string): Promise<void> {
    const text = this.safeText(message);
    const target = this.multiChannelEnabled ? this.customerGroupId : this.groupChatId;
    if (target) {
      await this.bot.telegram.sendMessage(target, text).catch(e => this.logger.warn(`sendToCustomer group failed: ${e.message}`));
    } else {
      this.logger.warn('No customer channel configured');
    }
    // Also fan out to any active DM customers
    for (const dmId of this.activeDmCustomerIds) {
      await this.bot.telegram.sendMessage(dmId, text).catch(e => this.logger.warn(`sendToCustomer DM ${dmId} failed: ${e.message}`));
    }
  }

  async sendToTech(message: string): Promise<void> {
    const target = this.multiChannelEnabled ? this.techGroupId : this.groupChatId;
    if (!target) { this.logger.warn('No tech channel configured'); return; }
    await this.bot.telegram.sendMessage(target, this.safeText(message));
  }

  /** Legacy alias — ops = operator */
  async sendToOps(message: string): Promise<void> {
    return this.sendToOperator(message);
  }

  /** Send a message to a specific chat by ID */
  async sendToChat(chatId: string, message: string): Promise<void> {
    if (!chatId) return;
    await this.bot.telegram.sendMessage(chatId, this.safeText(message));
  }

  // ─── Structured ops posts ──────────────────────────────────────────────────

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

    await this.sendToOperator(lines.join('\n'));
    this.logger.log(`Emergency alert: ${data.severity} — ${data.issue}`);
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

    await this.sendToOperator(lines.join('\n'));
    this.logger.log(`Dispatch decision: ${decision.selectedTechName}`);
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

    // Dispatch order goes to both operator and tech channels
    await this.sendToOperator(lines.join('\n'));
    await this.sendToTech(lines.join('\n'));
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

    await this.sendToOperator(lines.join('\n'));
    this.logger.log('Escalation posted');
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

    const decisionLines = decisions.map(d =>
      d.action === 'reassign'
        ? `  Reassigned: ${d.jobType} @ ${d.customerName} → ${d.reassignToTechName} at ${d.newTime}`
        : `  Rescheduled: ${d.jobType} @ ${d.customerName} → ${d.newDay ?? 'next available'}`
    );

    const lines = [
      '📅 SCHEDULE UPDATE',
      `Trigger: ${triggerLabel}`,
      '',
      'Cascade decisions:',
      ...decisionLines,
      '',
      'All affected customers notified.',
    ];

    await this.sendToOperator(lines.join('\n'));
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

    await this.sendToOperator(lines.join('\n'));
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
      'Action: Offer to fix at no charge per warranty policy.',
    ];

    await this.sendToOperator(lines.join('\n'));
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
          job.status === 'completed' ? '✅' :
          job.status === 'paused' ? '⏸' :
          job.status === 'needs_rescheduling' ? '🔄' : '⚠️';
        lines.push(`  ${icon} ${job.time} — ${job.type} @ ${job.customerName}${job.bumpable ? ' [bumpable]' : ''} [${job.status}]`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
