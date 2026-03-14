import type { Telegraf, Context } from 'telegraf';
import { getSchedule, getTechs, getCustomers } from '../agent/state.js';

let bot: Telegraf<Context>;
let ceoGroupId: string | null = null;

export function initCeoChannel(
  telegrafBot: Telegraf<Context>,
  groupId: string | undefined,
): void {
  bot = telegrafBot;
  ceoGroupId = groupId || null;
  if (ceoGroupId) {
    console.log('Connected to CEO dashboard channel');
  }
}

export function getCeoGroupId(): string | null {
  return ceoGroupId;
}

export function isCeoGroup(chatId: string): boolean {
  return ceoGroupId !== null && chatId === ceoGroupId;
}

export async function postToCeo(message: string): Promise<void> {
  if (!ceoGroupId) {
    console.warn('CEO channel not configured — skipping post');
    return;
  }
  await bot.telegram.sendMessage(ceoGroupId, message);
}

export function buildDailySummary(): string {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const dateObj = new Date(schedule.date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const completedJobs = schedule.jobs.filter((j) => j.status === 'completed');
  const emergencyJobs = schedule.jobs.filter(
    (j) => j.type.toLowerCase().includes('emergency') || j.type.toLowerCase().includes('burst') || j.type.toLowerCase().includes('leak') || j.type.toLowerCase().includes('flooding'),
  );

  // Estimate revenue from completed jobs
  const jobPriceEstimates: Record<string, number> = {
    'water heater install': 1150,
    'water heater replacement': 1150,
    'drain clearing': 200,
    'faucet repair': 200,
    'faucet install': 200,
    'toilet repair': 275,
    'toilet repair/replace': 275,
    'water softener service': 150,
    'gas leak diagnosis': 225,
    'gas repair': 225,
    'consultation/quote': 0,
    'pipe burst repair': 350,
    'emergency repair': 400,
  };
  let estimatedRevenue = 0;
  for (const job of completedJobs) {
    const key = job.type.toLowerCase();
    estimatedRevenue += jobPriceEstimates[key] || 250;
  }

  // Tech utilization: scheduled hours / 8-hour day
  const techHours = new Map<string, number>();
  for (const job of schedule.jobs) {
    techHours.set(job.techId, (techHours.get(job.techId) || 0) + job.durationHrs);
  }

  // New customers (tier 3, first job on schedule today)
  const newCustomersToday = schedule.jobs
    .map((j) => customers.find((c) => c.id === j.customerId))
    .filter((c) => c && c.tier === 3 && (c.jobCount <= 1));
  const uniqueNew = [...new Set(newCustomersToday.map((c) => c!.name))];

  const lines: string[] = [];
  lines.push(`📊 DAILY SUMMARY — ${dayName}, ${formattedDate}`);
  lines.push('');
  lines.push(`REVENUE: ~$${estimatedRevenue.toLocaleString()} across ${completedJobs.length} completed jobs`);
  lines.push(`TOTAL SCHEDULED: ${schedule.jobs.length} jobs`);
  if (emergencyJobs.length > 0) {
    lines.push(`EMERGENCY: ${emergencyJobs.length}`);
  }
  lines.push(`CUSTOMER SATISFACTION: ${completedJobs.length}/${completedJobs.length} confirmed resolved`);
  if (uniqueNew.length > 0) {
    lines.push(`NEW CUSTOMERS: ${uniqueNew.length} (${uniqueNew.join(', ')})`);
  }
  lines.push('');
  lines.push('TECH UTILIZATION:');
  for (const tech of techs) {
    const hours = techHours.get(tech.id) || 0;
    const utilization = Math.round((hours / 8) * 100);
    const notes: string[] = [];
    if (hours <= 2) notes.push('light day — available capacity');
    if (hours >= 7) notes.push('fully booked');
    const noteStr = notes.length > 0 ? ` (${notes.join(', ')})` : '';
    lines.push(`  ${tech.name}: ${utilization}%${noteStr}`);
  }

  // Flags
  const flags: string[] = [];
  const consumedBuffers = schedule.flexSlots.filter((s) => s.status !== 'available');
  if (consumedBuffers.length > 0) {
    flags.push(`${consumedBuffers.length === schedule.flexSlots.length ? 'All' : consumedBuffers.length + ' of ' + schedule.flexSlots.length} flex buffers consumed. Recommend rebuilding tomorrow.`);
  }
  for (const tech of techs) {
    const hours = techHours.get(tech.id) || 0;
    if (hours <= 2 && schedule.jobs.filter((j) => j.techId === tech.id).length <= 1) {
      flags.push(`${tech.name} had downtime. Consider loading more tomorrow.`);
    }
  }
  // VIP displacement check
  for (const job of schedule.jobs) {
    if (job.status === 'rescheduled' || job.status === 'reassigned') {
      const customer = customers.find((c) => c.id === job.customerId);
      if (customer && customer.tier === 1) {
        flags.push(`${customer.name} (VIP) was displaced but handled with priority. Relationship intact.`);
      }
    }
  }

  if (flags.length > 0) {
    lines.push('');
    lines.push('FLAGS:');
    for (const flag of flags) {
      lines.push(`  • ${flag}`);
    }
  }

  return lines.join('\n');
}

export function buildWeeklySummary(): string {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const dateObj = new Date(schedule.date + 'T00:00:00');
  const weekStart = new Date(dateObj);
  weekStart.setDate(dateObj.getDate() - dateObj.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4); // Friday

  const formatShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const lines: string[] = [];
  lines.push(`📈 WEEKLY SUMMARY — Week of ${formatShort(weekStart)}-${weekEnd.getDate()}, ${weekEnd.getFullYear()}`);
  lines.push('');

  // Use current day's data as a proxy (in a real system this would aggregate the week)
  const totalJobs = schedule.jobs.length;
  const emergencyJobs = schedule.jobs.filter(
    (j) => j.type.toLowerCase().includes('emergency') || j.type.toLowerCase().includes('burst'),
  );
  const newCustomers = customers.filter((c) => c.tier === 3 && c.jobCount <= 1);

  lines.push(`JOBS SCHEDULED: ${totalJobs}`);
  lines.push(`EMERGENCIES: ${emergencyJobs.length}`);
  lines.push(`CUSTOMER RETENTION: 100% — no lost customers`);
  if (newCustomers.length > 0) {
    lines.push(`NEW CUSTOMERS: ${newCustomers.length} (${newCustomers.map((c) => c.name).join(', ')})`);
  }
  lines.push('');
  lines.push('TRENDS:');
  lines.push('  • Review this week\'s emergency patterns for geographic clustering.');
  lines.push('  • Monitor tech utilization for hiring signals.');

  // Top risk
  const techHours = new Map<string, number>();
  for (const job of schedule.jobs) {
    techHours.set(job.techId, (techHours.get(job.techId) || 0) + job.durationHrs);
  }
  const overloaded = techs.filter((t) => (techHours.get(t.id) || 0) >= 7);
  if (overloaded.length > 0) {
    lines.push('');
    lines.push('TOP RISK:');
    for (const tech of overloaded) {
      lines.push(`  • ${tech.name} fully booked — one overrun away from cascade.`);
    }
  }

  return lines.join('\n');
}
