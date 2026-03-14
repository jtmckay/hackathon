import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHistory, appendHistory, appendServiceEvent, getTechs, getSchedule, getCustomers, getReminders, type ChannelId } from './state.js';
import { generateSnapshot } from './snapshot.js';
import { resolveAccount, type ResolvedAccount } from './account-resolver.js';
import { buildRelationshipSummary } from './relationship-summary.js';
import { buildReminderBriefing } from './reminders.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const client = new Anthropic();

function buildSystemPrompt(customerContext: string): string {
  const template = readFileSync(join(ROOT, 'prompts', 'system-prompt.md'), 'utf-8');
  const snapshot = generateSnapshot();
  const reminderContext = buildReminderBriefing();
  const fullSnapshot = reminderContext
    ? snapshot + '\n\n' + reminderContext
    : snapshot;
  return template
    .replace('{{STATE_SNAPSHOT}}', fullSnapshot)
    .replace('{{CUSTOMER_CONTEXT}}', customerContext);
}

/** Extract sender name from enriched message prefix */
function extractSenderName(message: string): string {
  // Match patterns like "[Customer: Garcia, ...]:", "[Customer - SomeName]:", "Tech Marcus says:", "[Ops - Blake]:"
  const customerMatch = message.match(/^\[Customer:\s*(\w+)/);
  if (customerMatch) return customerMatch[1];

  const unknownCustomerMatch = message.match(/^\[Customer\s*-\s*(\w+)\]/);
  if (unknownCustomerMatch) return unknownCustomerMatch[1];

  const techMatch = message.match(/^Tech\s+(\w+)\s+says:/);
  if (techMatch) return techMatch[1];

  const opsMatch = message.match(/^\[Ops\s*-\s*(\w+)\]/);
  if (opsMatch) return opsMatch[1];

  return 'Unknown';
}

/**
 * Build tech-specific context for injecting into the system prompt when
 * a message arrives from a tech channel.
 */
function buildTechContext(techId: string): string {
  const techs = getTechs();
  const tech = techs.find((t) => t.id === techId);
  if (!tech) return '';

  const schedule = getSchedule();
  const customers = getCustomers();
  const techJobs = schedule.jobs.filter((j) => j.techId === techId);

  const lines: string[] = [];
  lines.push(`TECH CHANNEL CONTEXT — ${tech.name}`);
  lines.push('━'.repeat(40));
  lines.push(`Tech: ${tech.name} (${tech.seniority}, ${tech.years} years)`);
  lines.push(`Status: ${tech.status}`);
  lines.push(`Location: ${tech.currentLocation}`);
  if (tech.currentJobId) {
    const currentJob = schedule.jobs.find(
      (j) => String(j.id) === String(tech.currentJobId),
    );
    if (currentJob) {
      const customer = customers.find((c) => c.id === currentJob.customerId);
      lines.push(
        `Current job: ${currentJob.type} for ${customer?.name || currentJob.customerId} at ${currentJob.address}`,
      );
    }
  }
  lines.push('');
  lines.push("Today's schedule:");
  for (const job of techJobs) {
    const customer = customers.find((c) => c.id === job.customerId);
    lines.push(
      `  ${job.time} — ${job.type} for ${customer?.name || job.customerId} at ${job.address} [${job.status}]`,
    );
  }

  return lines.join('\n');
}

/**
 * Build strategic business context for the CEO channel.
 * High-level metrics, no operational details.
 */
function buildCeoContext(): string {
  const techs = getTechs();
  const schedule = getSchedule();
  const customers = getCustomers();
  const reminders = getReminders({ status: 'active' });

  const lines: string[] = [];
  lines.push('CEO DASHBOARD CONTEXT');
  lines.push('━'.repeat(40));
  lines.push(`This is the CEO channel. Respond like a sharp COO giving a board-ready briefing.`);
  lines.push(`Lead with numbers. Follow with trends. Close with recommendations. No fluff, no operational details.`);
  lines.push('');
  lines.push('BUSINESS METRICS:');

  const totalCustomers = customers.length;
  const vipCount = customers.filter((c) => c.tier === 1).length;
  const totalLifetimeValue = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);
  const totalJobs = schedule.jobs.length;
  const techCount = techs.length;

  lines.push(`  Customers: ${totalCustomers} (${vipCount} VIP)`);
  lines.push(`  Total lifetime value: $${totalLifetimeValue.toLocaleString()}`);
  lines.push(`  Today's schedule: ${totalJobs} jobs across ${techCount} techs`);
  lines.push(`  Active reminders: ${reminders.length}`);

  // Tech utilization overview
  const techHours = new Map<string, number>();
  for (const job of schedule.jobs) {
    techHours.set(job.techId, (techHours.get(job.techId) || 0) + job.durationHrs);
  }
  const avgUtil = Math.round(
    (techs.reduce((sum, t) => sum + (techHours.get(t.id) || 0), 0) / (techs.length * 8)) * 100,
  );
  lines.push(`  Average tech utilization: ${avgUtil}%`);

  return lines.join('\n');
}

export async function chat(
  channel: ChannelId,
  userMessage: string,
): Promise<string> {
  // Build context based on channel type
  let customerContext = '';
  let resolved: ResolvedAccount | null = null;

  if (channel === 'ceo') {
    // CEO channel — inject strategic business context
    customerContext = buildCeoContext();
  } else if (channel.startsWith('tech:')) {
    // Tech channel — inject tech context instead of customer context
    const techId = channel.substring(5);
    customerContext = buildTechContext(techId);
  } else {
    // Customer or ops channel — resolve customer account
    const senderName = extractSenderName(userMessage);
    resolved = resolveAccount(senderName, userMessage, channel as 'customer' | 'ops');
    customerContext = buildRelationshipSummary(resolved.customer);
  }

  const systemPrompt = buildSystemPrompt(customerContext);
  const history = getHistory(channel);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const assistantMessage = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  // Save raw response (with directives) to history so the agent
  // retains awareness of its own previous actions
  appendHistory(channel, [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantMessage },
  ]);

  // Log communication event to the customer's service ledger (skip for tech channels)
  if (resolved) {
    logInteractionEvent(resolved, channel, userMessage, assistantMessage);
  }

  return assistantMessage;
}

function logInteractionEvent(
  resolved: ResolvedAccount,
  channel: ChannelId,
  userMessage: string,
  assistantMessage: string,
): void {
  const now = new Date().toISOString();

  // Determine event type based on content signals
  let eventType: 'communication' | 'intake' = 'communication';
  const lower = userMessage.toLowerCase();
  if (
    resolved.isNew ||
    lower.includes('emergency') ||
    lower.includes('flooding') ||
    lower.includes('leak') ||
    lower.includes('burst')
  ) {
    eventType = 'intake';
  }

  // Detect sentiment from message
  let sentiment: 'positive' | 'neutral' | 'negative' | 'distressed' = 'neutral';
  if (lower.includes('help') || lower.includes('emergency') || lower.includes('flooding') || lower.includes('panic')) {
    sentiment = 'distressed';
  } else if (lower.includes('thank') || lower.includes('great') || lower.includes('happy')) {
    sentiment = 'positive';
  } else if (lower.includes('complain') || lower.includes('unhappy') || lower.includes('frustrated') || lower.includes('angry')) {
    sentiment = 'negative';
  }

  appendServiceEvent(resolved.customer.id, {
    id: `evt-${resolved.customer.id}-${Date.now()}`,
    timestamp: now,
    type: eventType,
    channel: channel.startsWith('tech:') ? 'tech' : channel === 'customer' ? 'customer' : 'ops',
    summary: `${channel.startsWith('tech:') ? 'Tech' : channel === 'customer' ? 'Customer' : 'Ops'} interaction: ${userMessage.substring(0, 120)}`,
    details: `Agent response: ${assistantMessage.substring(0, 300)}`,
    sentiment,
  });
}
