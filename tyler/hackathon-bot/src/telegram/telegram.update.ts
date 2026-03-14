import { Update, Ctx, Start, Command, On, InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
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
    @InjectBot() private bot: Telegraf<Context>,
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
    this.telegram.clearDmCustomers();
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

  @On('photo')
  async onPhoto(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    const chatId = String(ctx.chat.id);
    const channelType = this.telegram.resolveChannel(chatId);
    if (channelType === 'unknown') return;

    if (this.processingChats.has(chatId)) return;

    const senderName = message.from?.first_name || 'Customer';
    const agentChannel = channelType === 'customer' ? 'customer' : channelType === 'tech' ? 'tech' : 'ops';
    const caption = message.caption || '';

    this.logger.log(`[${channelType}] ${senderName}: [photo]${caption ? ` — "${caption}"` : ''}`);

    this.processingChats.add(chatId);
    await ctx.sendChatAction('typing').catch(() => {});
    const typingInterval = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);

    try {
      // Get the highest-res photo from Telegram
      const photos = message.photo as any[];
      const bestPhoto = photos[photos.length - 1];
      const fileInfo = await this.bot.telegram.getFile(bestPhoto.file_id);
      const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

      const result = await this.agent.chatWithImage(chatId, agentChannel, senderName, imageUrl, caption);

      // Forward photo + analysis to operator channel (if message came from customer or tech)
      if (channelType === 'customer' || channelType === 'tech') {
        const operatorId = this.telegram.operatorGroupId;
        if (operatorId && operatorId !== chatId) {
          await this.bot.telegram.forwardMessage(Number(operatorId), Number(chatId), message.message_id);
          await this.telegram.sendToOperator(`Photo analysis (from ${senderName}):\n${result.response}`);
        }
      }

      // Handle any tools that fired (same as text handler)
      if (result.emergencyAlert) {
        const ea = result.emergencyAlert;
        await this.telegram.postEmergencyAlert(ea);
        const operatorId = this.telegram.operatorGroupId;
        if (operatorId) {
          this.agent.injectMessage(operatorId, 'assistant',
            `EMERGENCY INCOMING — ${ea.severity}\nCustomer: ${ea.customerName}${ea.address ? ` at ${ea.address}` : ''}\nIssue: ${ea.issue}\nSafety: ${ea.safetyConcerns || 'none'}\nPhoto has been forwarded. Say "proceed" or "send [tech name]" to dispatch.`);
        }
        if (channelType === 'customer') {
          await this.telegram.sendToCustomer("Got your photo — I can see the issue. I'm getting a tech dispatched to you right now. Sit tight.");
        }
      }

      await ctx.reply(stripMarkdown(result.response) || 'Got your photo. On it.');
    } catch (error) {
      this.logger.error(`Photo handler error [${channelType}]: ${error.message}`);
      await ctx.reply("Got your photo. Let me take a look — can you also describe what's happening in a message?").catch(() => {});
    } finally {
      clearInterval(typingInterval);
      this.processingChats.delete(chatId);
    }
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

    // Track DM customers so fan-out messages reach them too
    if (channelType === 'customer' && !chatId.startsWith('-')) {
      this.telegram.registerDmCustomer(chatId);
    }

    // Map channel type to agent prompt type
    const agentChannel =
      channelType === 'customer' ? 'customer' :
      channelType === 'tech' ? 'tech' : 'ops';

    this.logger.log(`[${channelType}] ${senderName}: ${message.text}`);

    this.processingChats.add(chatId);
    await ctx.sendChatAction('typing').catch(() => {});
    const typingInterval = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);

    const MAX_ATTEMPTS = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          this.logger.log(`[retry] Attempt ${attempt}/${MAX_ATTEMPTS} for ${chatId} (${channelType})`);
        }

      const result = await this.agent.chat(
        chatId,
        agentChannel,
        `[${senderName}]: ${message.text}`,
      );

      // ── Emergency alert → operator only ──────────────────────────────────
      if (result.emergencyAlert) {
        const ea = result.emergencyAlert;
        this.logger.log(`Emergency: ${ea.severity}`);
        await this.telegram.postEmergencyAlert(ea);

        // Inject into operator channel history so the operator agent can act on it
        const operatorId = this.telegram.operatorGroupId;
        if (operatorId) {
          this.agent.injectMessage(
            operatorId,
            'assistant',
            `EMERGENCY INCOMING — ${ea.severity}\nCustomer: ${ea.customerName}${ea.address ? ` at ${ea.address}` : ''}\nIssue: ${ea.issue}\nSafety: ${ea.safetyConcerns || 'none'}\nStatus: Qualifying — awaiting dispatch decision.\nAll tech details and schedule are available. Say "proceed" or "send [tech name]" to dispatch immediately.`,
          );
        }

        // Heartbeat to customer — they hear something immediately while operator deliberates
        if (channelType === 'customer') {
          await this.telegram.sendToCustomer(
            "Got it — your situation has been flagged and I'm working on getting a tech to you right now. Sit tight, I'll confirm who's coming and when in just a moment.",
          );
        }
      }

      // ── Dispatch → update DB, post to operator + tech ────────────────────
      if (result.dispatchDecision) {
        let d = result.dispatchDecision;
        this.logger.log(`Dispatch: ${d.selectedTechName}`);

        // Validate tech ID — fall back to first available if Claude hallucinated an ID
        let pausedJobId: string | undefined;
        try {
          const assigned = await this.schedule.assignEmergency(d.selectedTechId, {
            type: d.emergencyJobType || 'emergency_response',
            address: d.emergencyAddress,
            customerName: d.customerName,
            durationHrs: 2,
            notes: d.issueDescription,
          });
          pausedJobId = assigned.pausedJobId;
        } catch (assignErr) {
          this.logger.warn(`assignEmergency failed for techId "${d.selectedTechId}" — falling back to first available: ${assignErr.message}`);
          const fallback = await this.schedule.getFirstAvailableTech();
          if (!fallback) {
            this.logger.error('No available tech found for fallback dispatch');
            throw assignErr;
          }
          this.logger.log(`Fallback dispatch → ${fallback.name} (${fallback.id})`);
          d = { ...d, selectedTechId: fallback.id, selectedTechName: fallback.name };
          const assigned = await this.schedule.assignEmergency(d.selectedTechId, {
            type: d.emergencyJobType || 'emergency_response',
            address: d.emergencyAddress,
            customerName: d.customerName,
            durationHrs: 2,
            notes: d.issueDescription,
          });
          pausedJobId = assigned.pausedJobId;
        }

        const idsToDisplace = (d.futureTechJobIds || []).filter(id => id !== pausedJobId);
        await this.schedule.markJobsDisplaced(idsToDisplace);

        const displaced = await this.schedule.getDisplacedJobs(d.selectedTechId);

        // Inject dispatch into operator history
        const operatorId = this.telegram.operatorGroupId;
        if (operatorId) {
          this.agent.injectMessage(
            operatorId,
            'assistant',
            `DISPATCHED: ${d.selectedTechName} → ${d.customerName} at ${d.emergencyAddress}. ETA ~${d.estimatedDriveMinutes} min. Reason: ${d.selectionReason}`,
          );
        }

        // Confirmed ETA to customer as soon as dispatch fires
        const techFirstName = d.selectedTechName.split(' ')[0];
        await this.telegram.sendToCustomer(
          `Good news — ${techFirstName} is heading your way now. Estimated arrival: about ${d.estimatedDriveMinutes} minutes. He'll call when he's 5 minutes out.`,
        );

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
      const replyText = stripMarkdown(result.response) || 'On it.';
      await ctx.reply(replyText);

      // Success — exit retry loop
      lastError = undefined;
      break;

    } catch (error) {
      lastError = error;
      this.logger.error(`Error [${channelType}] attempt ${attempt}/${MAX_ATTEMPTS}: ${error.message}`);
      if (attempt < MAX_ATTEMPTS) {
        this.logger.log(`[retry] Waiting 1s before attempt ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    } // end retry loop

    if (lastError) {
      this.logger.error(`All ${MAX_ATTEMPTS} attempts failed for ${chatId}: ${lastError.message}`);
      await ctx.reply('Sorry, I ran into an issue. Please try again.').catch(() => {});
    }

    clearInterval(typingInterval);
    this.processingChats.delete(chatId);
  }
}
