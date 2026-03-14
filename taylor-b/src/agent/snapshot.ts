import { getTechs, getSchedule, getCustomers } from './state.js';

export function generateSnapshot(): string {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const lines: string[] = [];

  lines.push('=== SHAMROCK PLUMBING — OPERATIONAL SNAPSHOT ===');
  lines.push(`Date: ${schedule.date} (${schedule.day})`);
  lines.push(`Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`);
  lines.push('');

  lines.push("--- TODAY'S SCHEDULE ---");
  for (const job of schedule.jobs) {
    const customer = customers.find((c) => c.id === job.customerId);
    const tierLabel = customer ? ` (Tier ${customer.tier})` : '';
    lines.push(
      `  [${job.status.toUpperCase()}] ${job.time} - ${job.type} | Tech: ${job.techId} | Customer: ${job.customerId}${tierLabel} | Address: ${job.address} | Duration: ${job.durationHrs}h | Bumpable: ${job.bumpable} | Notes: ${job.notes}`,
    );
  }
  lines.push('');

  lines.push('--- FLEX BUFFER SLOTS ---');
  let consumed = 0;
  for (const slot of schedule.flexSlots) {
    lines.push(
      `  [${slot.status.toUpperCase()}] ${slot.time} - ${slot.type} | Duration: ${slot.duration_hrs}h | ${slot.notes}`,
    );
    if (slot.status !== 'available') consumed++;
  }
  if (consumed > 0) {
    lines.push(
      `  ⚠ WARNING: ${consumed} of ${schedule.flexSlots.length} flex buffers consumed`,
    );
  }
  lines.push('');

  lines.push('--- TECH ROSTER ---');
  for (const tech of techs) {
    const certs =
      tech.certifications.length > 0 ? tech.certifications.join(', ') : 'none';
    lines.push(
      `  ${tech.name} (${tech.seniority}, ${tech.years}yr) | Status: ${tech.status} | Location: ${tech.currentLocation} | Specialties: ${tech.specialties.join(', ')} | Certs: ${certs} | Rating: ${tech.metrics.avgRating}`,
    );
  }
  lines.push('');

  lines.push('--- FLAGS ---');
  let hasFlags = false;

  // Check overbooked techs
  const techJobs = new Map<string, number>();
  for (const job of schedule.jobs) {
    techJobs.set(job.techId, (techJobs.get(job.techId) || 0) + 1);
  }
  for (const [techId, count] of techJobs) {
    if (count > 3) {
      lines.push(`  ⚠ Overbooked: ${techId} has ${count} jobs`);
      hasFlags = true;
    }
  }

  // Check fully booked techs
  const techHours = new Map<string, number>();
  for (const job of schedule.jobs) {
    techHours.set(job.techId, (techHours.get(job.techId) || 0) + job.durationHrs);
  }
  for (const [techId, hours] of techHours) {
    if (hours >= 7) {
      lines.push(
        `  ⚠ ${techId} is fully booked (${hours}h scheduled) — no flex in their day`,
      );
      hasFlags = true;
    }
  }

  if (consumed > 0) {
    lines.push('  ⚠ Flex buffer(s) consumed — reduced emergency capacity');
    hasFlags = true;
  }

  if (!hasFlags) {
    lines.push('  ✓ All clear — flex buffers available, no overbooked techs');
  }

  lines.push('');
  lines.push('=== END SNAPSHOT ===');

  return lines.join('\n');
}
