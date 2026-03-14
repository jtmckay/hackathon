import { getSchedule, getTechs, getCustomers } from '../agent/state.js';
import { postToOps } from './groups.js';
import { postToTech, getAllTechChannels } from './tech-channels.js';
import { buildReminderBriefing, processDueReminders } from '../agent/reminders.js';

export async function postMorningSchedule(): Promise<void> {
  // Post full strategic briefing to ops (with reminders)
  const message = buildMorningBriefing();
  const reminderSection = buildReminderBriefing();
  const fullBriefing = reminderSection
    ? message + '\n\n' + reminderSection
    : message;
  await postToOps(fullBriefing);

  // Process any due reminders
  await processDueReminders();

  // Post per-tech schedules to each tech's channel
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();
  const configuredChannels = getAllTechChannels();

  const dateObj = new Date(schedule.date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  for (const channel of configuredChannels) {
    const tech = techs.find((t) => t.id === channel.techId);
    if (!tech) continue;

    const techSchedule = buildTechMorningSchedule(
      tech,
      schedule,
      customers,
      dayName,
    );
    await postToTech(channel.techId, techSchedule);
  }
}

export function buildTechMorningSchedule(
  tech: { id: string; name: string },
  schedule: ReturnType<typeof getSchedule>,
  customers: ReturnType<typeof getCustomers>,
  dayName: string,
): string {
  const jobs = schedule.jobs.filter((j) => j.techId === tech.id);
  const lines: string[] = [];

  lines.push(`☀️ Good morning ${tech.name} — here's your ${dayName}:`);
  lines.push('');

  if (jobs.length === 0) {
    lines.push('  No jobs scheduled today.');
  } else {
    for (const job of jobs) {
      const customer = customers.find((c) => c.id === job.customerId);
      lines.push(`  ${formatTime(job.time)} — ${customer?.name || job.customerId}, ${job.type} (${job.address})`);

      // Add friendly customer notes (not strategic tier info)
      const notes: string[] = [];
      if (customer) {
        if (customer.tier === 1) {
          const yearsSince = customer.customerSince
            ? Math.floor(
                (new Date().getTime() - new Date(customer.customerSince).getTime()) /
                  (365.25 * 24 * 60 * 60 * 1000),
              )
            : 0;
          if (yearsSince > 0) {
            notes.push(`⭐ VIP customer — ${yearsSince} years with us`);
          }
        }
        if (customer.jobCount === 0 || (customer.customerSince === null)) {
          notes.push('New customer, first time. Make a good impression.');
        }
        // Extract friendly notes from customer notes (skip strategic info)
        if (customer.notes) {
          const friendlyPatterns = [
            /dog|cat|pet/i,
            /cookies|coffee|snacks/i,
            /prefers?\s+morning/i,
            /prefers?\s+afternoon/i,
            /friendly/i,
            /requests?\s+\w+/i,
          ];
          for (const pattern of friendlyPatterns) {
            const match = customer.notes.match(pattern);
            if (match) {
              // Extract the sentence containing the match
              const sentences = customer.notes.split(/\.\s*/);
              const relevant = sentences.find((s) => pattern.test(s));
              if (relevant) {
                notes.push(relevant.trim().replace(/\.$/, ''));
              }
            }
          }
        }
      }
      if (job.notes && !job.notes.startsWith('Rescheduled')) {
        notes.push(job.notes);
      }

      // Deduplicate and limit notes
      const uniqueNotes = [...new Set(notes)].slice(0, 2);
      for (const note of uniqueNotes) {
        lines.push(`           ${note}`);
      }
    }
  }

  lines.push('');
  const jobCount = jobs.length;
  lines.push(
    `${jobCount} job${jobCount !== 1 ? 's' : ''} today. ${jobCount <= 2 ? "You've got buffer time built in. " : ''}Have a good one.`,
  );

  return lines.join('\n');
}

export function buildMorningBriefing(): string {
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

  const lines: string[] = [];
  lines.push(`☀️ GOOD MORNING — ${dayName}, ${formattedDate}`);
  lines.push('');
  lines.push("TODAY'S SCHEDULE:");
  lines.push('');

  // Build schedule by tech
  const techJobsMap = new Map<string, typeof schedule.jobs>();
  for (const tech of techs) {
    techJobsMap.set(tech.id, []);
  }
  for (const job of schedule.jobs) {
    const existing = techJobsMap.get(job.techId);
    if (existing) {
      existing.push(job);
    }
  }

  for (const tech of techs) {
    const jobs = techJobsMap.get(tech.id) || [];
    lines.push(`${tech.name} (${capitalize(tech.seniority)}):`);

    if (jobs.length === 0) {
      lines.push('  No jobs scheduled');
    } else {
      for (const job of jobs) {
        const customer = customers.find((c) => c.id === job.customerId);
        const tierLabel = customer ? `Tier ${customer.tier}` : 'unknown tier';
        const bumpLabel = job.bumpable ? 'bumpable' : 'NOT bumpable';
        lines.push(
          `  ${formatTime(job.time)} — ${job.type} for ${customer?.name || job.customerId} (${tierLabel}, ${bumpLabel})`,
        );
      }
    }
    lines.push('');
  }

  // Flex buffer status
  lines.push('FLEX BUFFERS:');
  for (const slot of schedule.flexSlots) {
    const icon = slot.status === 'available' ? '✅' : '❌';
    const label = slot.id === 'flex-am' ? 'Morning' : 'Afternoon';
    const status =
      slot.status === 'available' ? 'Available' : `Consumed — ${slot.notes}`;
    lines.push(`  ${icon} ${label} (${formatTime(slot.time)}): ${status}`);
  }
  lines.push('');

  // Flags
  lines.push('⚠️ FLAGS:');
  const flags: string[] = [];

  // Check fully booked techs
  const techHours = new Map<string, number>();
  for (const job of schedule.jobs) {
    techHours.set(
      job.techId,
      (techHours.get(job.techId) || 0) + job.durationHrs,
    );
  }
  for (const tech of techs) {
    const hours = techHours.get(tech.id) || 0;
    const jobs = techJobsMap.get(tech.id) || [];

    if (hours >= 7) {
      const hasNonBumpable = jobs.some((j) => !j.bumpable);
      flags.push(
        `${tech.name} is booked solid (${hours}h)${hasNonBumpable ? ' with non-interruptible jobs' : ''} — no flex in their day`,
      );
    }

    // Check for long non-interruptible jobs that could cause cascade
    for (const job of jobs) {
      if (!job.bumpable && job.durationHrs >= 3) {
        flags.push(
          `${job.type} for ${customers.find((c) => c.id === job.customerId)?.name || job.customerId} is non-interruptible (${job.durationHrs}h) — plan around ${tech.name} being unavailable during this window`,
        );
      }
    }
  }

  // Check for techs with light days (available for reassignment)
  for (const tech of techs) {
    const jobs = techJobsMap.get(tech.id) || [];
    const hours = techHours.get(tech.id) || 0;
    if (jobs.length <= 1 && hours <= 2) {
      const lastJobEnd = jobs.length > 0
        ? estimateEndTime(jobs[0].time, jobs[0].durationHrs)
        : null;
      flags.push(
        `${tech.name} has only ${jobs.length} job${jobs.length !== 1 ? 's' : ''} (${hours}h)${lastJobEnd ? ` — available for reassignment after ${lastJobEnd}` : ' — available all day'}`,
      );
    }
  }

  // Check if any flex buffers are consumed
  const consumedBuffers = schedule.flexSlots.filter(
    (s) => s.status !== 'available',
  );
  if (consumedBuffers.length > 0) {
    flags.push(
      `${consumedBuffers.length} of ${schedule.flexSlots.length} flex buffers already consumed — reduced emergency capacity`,
    );
  }

  if (flags.length === 0) {
    flags.push('All clear — flex buffers available, no overbooked techs');
  }
  for (const flag of flags) {
    lines.push(`  • ${flag}`);
  }
  lines.push('');

  // Customer notes for VIPs
  lines.push('CUSTOMER NOTES:');
  const vipNotes: string[] = [];
  for (const job of schedule.jobs) {
    const customer = customers.find((c) => c.id === job.customerId);
    if (!customer || customer.tier > 1) continue;

    const yearsSince = customer.customerSince
      ? Math.floor(
          (dateObj.getTime() - new Date(customer.customerSince).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        )
      : 0;
    const parts: string[] = [];
    if (yearsSince > 0) parts.push(`${yearsSince}-year customer`);
    if (customer.referralCount > 0)
      parts.push(`${customer.referralCount} referrals`);
    if (customer.notes) parts.push(customer.notes.split('.')[0]);

    vipNotes.push(
      `${customer.name} (Tier 1): ${parts.join(', ')} — ${job.type} at ${formatTime(job.time)}`,
    );
  }

  if (vipNotes.length === 0) {
    vipNotes.push('No Tier 1 customers on today\'s schedule');
  }
  for (const note of vipNotes) {
    lines.push(`  • ${note}`);
  }

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12}:00${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`;
}

function estimateEndTime(startTime: string, durationHrs: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + durationHrs * 60;
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  return formatTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
}
