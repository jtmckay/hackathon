import { Update, Ctx, Start, Command, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { TelegramService } from './telegram.service';
import { SeedService } from '../database/seed.service';
import { ScheduleService } from '../database/schedule.service';

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*\n?/, '').replace(/\n?```$/, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private processingChats: Set<string> = new Set();

  constructor(
    private agent: AgentService,
    private telegram: TelegramService,
    private seed: SeedService,
    private schedule: ScheduleService,
  ) {}

  /** Works in ANY chat — use this to discover group chat IDs */
  @Command('chatid')
  async chatIdCommand(@Ctx() ctx: Context) {
    const chatId = String(ctx.chat.id);
    const channel = this.telegram.resolveChannel(chatId);
    const chat = ctx.chat as any;
    const title = chat.title || chat.first_name || 'Unknown';
    await ctx.reply(
      `Chat ID: ${chatId}\nTitle: ${title}\nType: ${ctx.chat.type}\nRecognized as: ${channel}\n\nOperator configured: ${this.telegram.operatorGroupId || '(not set)'}\nCustomer configured: ${this.telegram.customerGroupId || '(not set)'}\nTech configured: ${this.telegram.techGroupId || '(not set)'}`,
    );
  }

  @Start()
  async start(@Ctx() ctx: Context) {
    const chatId = String(ctx.chat.id);
    const channel = this.telegram.resolveChannel(chatId);

    // Always log so we can see which chat is receiving /start
    this.logger.log(`/start received — chatId: ${chatId}, resolved as: ${channel}`);

    if (channel === 'unknown') {
      await ctx.reply(`Shamrock Plumbing Dispatch bot. This chat (ID: ${chatId}) is not configured. Use /chatid to see this chat's ID.`);
      return;
    }

    if (channel === 'operator') {
      await ctx.reply('Shamrock Plumbing Dispatch — Online. Operator channel ready.');
      await ctx.reply(await this.telegram.postSchedule());
    } else if (channel === 'customer') {
      await ctx.reply("Hi! You've reached Shamrock Plumbing. How can I help you today?");
    } else if (channel === 'tech') {
      await ctx.reply('Dispatch online. Report job completions, status updates, or issues here.');
      await ctx.reply(await this.telegram.postSchedule());
    }
  }

  @Command('schedule')
  async scheduleCommand(@Ctx() ctx: Context) {
    const channel = this.telegram.resolveChannel(String(ctx.chat.id));
    if (channel === 'unknown' || channel === 'customer') return;
    await ctx.reply(await this.telegram.postSchedule());
  }

  /** Tech-specific schedule: shows only the sending tech's jobs */
  @Command('myschedule')
  async myScheduleCommand(@Ctx() ctx: Context) {
    const channel = this.telegram.resolveChannel(String(ctx.chat.id));
    if (channel !== 'tech' && channel !== 'operator') return;

    const message = ctx.message as any;
    const firstName = message.from?.first_name || '';
    const sched = await this.techPersonalSchedule(firstName);
    await ctx.reply(sched);
  }

  @Command('reset')
  async resetCommand(@Ctx() ctx: Context) {
    const channel = this.telegram.resolveChannel(String(ctx.chat.id));
    if (channel !== 'operator') return;

    await ctx.reply('Resetting to Monday morning state...');
    await this.seed.resetAndSeed();
    this.agent.clearHistory();
    this.processingChats.clear();
    await ctx.reply('Reset complete.\n\n' + await this.telegram.postSchedule());
  }

  /** Build a personal schedule view for a tech by first name */
  private async techPersonalSchedule(firstName: string): Promise<string> {
    if (!firstName) return 'Could not determine your name. Make sure your Telegram first name matches your tech name.';

    const jobs = await this.schedule.getJobsForTech(firstName);
    if (!jobs.length) return `No jobs found for ${firstName} today.`;

    const lines = [`Schedule for ${firstName}:\n`];
    for (const job of jobs) {
      const icon =
        job.status === 'scheduled' ? '⏳' :
        job.status === 'in_progress' ? '🔧' :
        job.status === 'completed' ? '✅' :
        job.status === 'paused' ? '⏸' : '⚠️';
      lines.push(`${icon} ${job.time} — ${job.type}`);
      lines.push(`   Address: ${job.address}`);
      lines.push(`   Customer: ${job.customerName}`);
      if (job.notes) lines.push(`   Notes: ${job.notes}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    if (!message?.text || message.text.startsWith('/')) return;

    const chatId = String(ctx.chat.id);
    const channelType = this.telegram.resolveChannel(chatId);

    // Ignore messages from unknown channels entirely
    if (channelType === 'unknown') return;

    // Dedup — drop if already processing for this chat
    if (this.processingChats.has(chatId)) {
      this.logger.log(`[dedup] Dropping from ${chatId} (${channelType}) — in flight`);
      return;
    }

    const senderName = message.from?.first_name || 'User';

    // Map channel type to agent prompt type
    const agentChannel =
      channelType === 'customer' ? 'customer' :
      channelType === 'tech' ? 'tech' : 'ops';

    this.logger.log(`[${channelType}] ${senderName}: ${message.text}`);

    this.processingChats.add(chatId);
    await ctx.sendChatAction('typing').catch(() => {});
    const typingInterval = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);

    try {
      const result = await this.agent.chat(
        chatId,
        agentChannel,
        `[${senderName}]: ${message.text}`,
      );

      // ── Emergency alert → operator only ──────────────────────────────────
      if (result.emergencyAlert) {
        this.logger.log(`Emergency: ${result.emergencyAlert.severity}`);
        await this.telegram.postEmergencyAlert(result.emergencyAlert);
      }

      // ── Dispatch → update DB, post to operator + tech ────────────────────
      if (result.dispatchDecision) {
        const d = result.dispatchDecision;
        this.logger.log(`Dispatch: ${d.selectedTechName}`);

        const { pausedJobId } = await this.schedule.assignEmergency(d.selectedTechId, {
          type: d.emergencyJobType || 'emergency_response',
          address: d.emergencyAddress,
          customerName: d.customerName,
          durationHrs: 2,
          notes: d.issueDescription,
        });

        const idsToDisplace = (d.futureTechJobIds || []).filter(id => id !== pausedJobId);
        await this.schedule.markJobsDisplaced(idsToDisplace);

        const displaced = await this.schedule.getDisplacedJobs(d.selectedTechId);

        // Decision summary → operator
        await this.telegram.postDispatchDecision(d, displaced);
        // Dispatch order → operator + tech
        await this.telegram.postDispatchOrder({
          selectedTechName: d.selectedTechName,
          customerName: d.customerName,
          emergencyAddress: d.emergencyAddress,
          issueDescription: d.issueDescription,
          safetyConcerns: d.safetyConcerns,
          estimatedDriveMinutes: d.estimatedDriveMinutes,
        });
      }

      // ── Escalation → operator only ────────────────────────────────────────
      if (result.escalateToBlake) {
        this.logger.log('Escalating to Blake');
        await this.telegram.postEscalation(result.escalateToBlake);
      }

      // ── Cascade → execute decisions, notify customers, brief operator ─────
      if (result.cascade) {
        const c = result.cascade;
        this.logger.log(`Cascade (${c.trigger}): ${c.decisions.length} jobs`);

        if (c.trigger === 'tech_sick' && c.affectedTechId) {
          await this.schedule.markTechSick(c.affectedTechId);
        }

        let reassigned = 0;
        let rescheduled = 0;
        const customerNotifications: string[] = [];

        for (const dec of c.decisions) {
          if (!dec.jobId) {
            this.logger.warn(`Cascade missing jobId for ${dec.customerName} — skipping`);
            continue;
          }
          if (dec.action === 'reassign') {
            if (!dec.reassignToTechId || !dec.newTime) {
              this.logger.warn(`Incomplete reassign for ${dec.customerName} — falling back to reschedule`);
              await this.schedule.rescheduleJob(dec.jobId, 'Rescheduled — incomplete reassignment');
              rescheduled++;
            } else {
              await this.schedule.reassignJob(dec.jobId, dec.reassignToTechId, dec.newTime);
              reassigned++;
            }
          } else {
            await this.schedule.rescheduleJob(dec.jobId, `Rescheduled to ${dec.newDay ?? 'next available'}`);
            rescheduled++;
          }
          customerNotifications.push(`${dec.customerName} (${dec.customerTier}): ${dec.action}`);
          // Customer notifications go to customer group
          await this.telegram.sendToCustomer(`${dec.customerMessage}`);
        }

        await this.telegram.postScheduleRebuild(c.trigger, c.affectedTechName, c.decisions);
        await this.telegram.postBlakeBriefing({
          trigger: c.trigger,
          affectedTechName: c.affectedTechName,
          decisionsCount: c.decisions.length,
          reassigned,
          rescheduled,
          customerNotifications,
        });

        // Post updated schedule to operator
        await this.telegram.sendToOperator('Updated schedule:\n\n' + await this.telegram.postSchedule());
      }

      // ── Job completion → update DB, follow-up to customer ─────────────────
      if (result.completeJob) {
        const cj = result.completeJob;
        this.logger.log(`Job complete: ${cj.techName} — ${cj.jobType}`);
        await this.schedule.completeJob(cj.jobId, cj.techId);
        // Follow-up goes to customer group
        await this.telegram.sendToCustomer(cj.customerFollowUpMessage);
      }

      // ── Callback alert → operator only ────────────────────────────────────
      if (result.callbackAlert) {
        await this.telegram.postCallbackAlert(result.callbackAlert);
      }

      // ── Reply in the originating channel ──────────────────────────────────
      await ctx.reply(stripMarkdown(result.response));

    } catch (error) {
      this.logger.error(`Error [${channelType}]: ${error.message}`);
      await ctx.reply('Sorry, I ran into an issue. Please try again.');
    } finally {
      clearInterval(typingInterval);
      this.processingChats.delete(chatId);
    }
  }
}
