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

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply('Shamrock Plumbing Dispatch — Online and ready.');
    await ctx.reply(await this.telegram.postSchedule());
  }

  @Command('schedule')
  async scheduleCommand(@Ctx() ctx: Context) {
    await ctx.reply(await this.telegram.postSchedule());
  }

  @Command('reset')
  async resetCommand(@Ctx() ctx: Context) {
    await ctx.reply('Resetting to clean Monday morning state...');
    await this.seed.resetAndSeed();
    this.agent.clearHistory();
    this.processingChats.clear();
    await ctx.reply('Reset complete. Fresh schedule:\n\n' + await this.telegram.postSchedule());
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    if (!message?.text || message.text.startsWith('/')) return;

    const chatId = String(ctx.chat.id);

    if (this.processingChats.has(chatId)) {
      this.logger.log(`[dedup] Dropping message from ${chatId} — in flight`);
      return;
    }

    const channelType = this.telegram.resolveChannel(chatId);
    const senderName = message.from?.first_name || 'User';
    const agentChannel = channelType === 'customer' ? 'customer' : 'ops';

    this.logger.log(`[${channelType}] ${senderName}: ${message.text}`);

    this.processingChats.add(chatId);
    await ctx.sendChatAction('typing').catch(() => {});
    const typingInterval = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);

    try {
      const result = await this.agent.chat(chatId, agentChannel, `[${senderName}]: ${message.text}`);

      // Emergency alert
      if (result.emergencyAlert) {
        this.logger.log(`Emergency: ${result.emergencyAlert.severity}`);
        await this.telegram.postEmergencyAlert(result.emergencyAlert);
      }

      // Dispatch — update DB, post to ops
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

        await this.telegram.postDispatchDecision(d, displaced);
        await this.telegram.postDispatchOrder({
          selectedTechName: d.selectedTechName,
          customerName: d.customerName,
          emergencyAddress: d.emergencyAddress,
          issueDescription: d.issueDescription,
          safetyConcerns: d.safetyConcerns,
          estimatedDriveMinutes: d.estimatedDriveMinutes,
        });
      }

      // Escalation
      if (result.escalateToBlake) {
        this.logger.log('Escalating to Blake');
        await this.telegram.postEscalation(result.escalateToBlake);
      }

      // Cascade recovery — execute each decision, then post rebuilt schedule + briefing
      if (result.cascade) {
        const c = result.cascade;
        this.logger.log(`Cascade (${c.trigger}): ${c.decisions.length} jobs`);

        const customerNotifications: string[] = [];
        let reassigned = 0;
        let rescheduled = 0;

        for (const dec of c.decisions) {
          if (dec.action === 'reassign' && dec.reassignToTechId && dec.newTime) {
            await this.schedule.reassignJob(dec.jobId, dec.reassignToTechId, dec.newTime);
            reassigned++;
          } else {
            await this.schedule.rescheduleJob(dec.jobId, `Rescheduled to ${dec.newDay ?? 'next available'}`);
            rescheduled++;
          }
          customerNotifications.push(`${dec.customerName} (${dec.customerTier}): ${dec.action}`);

          // Post each customer notification to ops (in unified mode this doubles as customer msg)
          await this.telegram.sendToOps(
            `Customer notification — ${dec.customerName}:\n${dec.customerMessage}`,
          );
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
      }

      // Job completion
      if (result.completeJob) {
        const cj = result.completeJob;
        this.logger.log(`Job complete: ${cj.techName} — ${cj.jobType}`);
        await this.schedule.completeJob(cj.jobId || '', cj.techId);
        // Post follow-up to group (in unified mode, customer sees it)
        await this.telegram.sendToGroup(
          `Follow-up for ${cj.customerName}:\n${cj.customerFollowUpMessage}`,
        );
      }

      // Callback alert
      if (result.callbackAlert) {
        await this.telegram.postCallbackAlert(result.callbackAlert);
      }

      // Reply to user
      await ctx.reply(stripMarkdown(result.response));
    } catch (error) {
      this.logger.error(`Error: ${error.message}`);
      await ctx.reply('Sorry, I ran into an issue. Please try again.');
    } finally {
      clearInterval(typingInterval);
      this.processingChats.delete(chatId);
    }
  }
}
