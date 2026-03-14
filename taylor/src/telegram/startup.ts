import {
  getSchedule,
  getTechs,
  getCustomers,
  getReminders,
} from "../state/state.js";
import { postToOpsFormatted } from "./groups.js";
import { getTechChannels, postToTech } from "./tech-channels.js";
import { getUpcomingRemindersSummary } from "../agent/reminders.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAYS[d.getDay()];
}

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12}:00${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

function computeEndTime(startTime: string, durationHrs: number): string {
  const startHour = Number(startTime.split(":")[0]);
  const startMin = Number(startTime.split(":")[1]);
  const totalMin = (startHour + durationHrs) * 60 + startMin;
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

/**
 * Generate the morning briefing text for ops (pure function, no side effects).
 * Used by both Telegram bot and REPL.
 */
export function generateMorningBriefing(): { body: string; action: string } {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const lines: string[] = [];
  lines.push(`☀️ GOOD MORNING — ${formatDate(schedule.date)}`);
  lines.push("");
  lines.push("TODAY'S SCHEDULE:");
  lines.push("");

  // Group active jobs by tech
  const jobsByTech = new Map<string, typeof schedule.jobs>();
  for (const job of schedule.jobs.filter((j) => j.status === "scheduled" || j.status === "in_progress")) {
    const existing = jobsByTech.get(job.techId) ?? [];
    existing.push(job);
    jobsByTech.set(job.techId, existing);
  }

  // Sort techs by seniority: senior → mid → junior
  const seniorityOrder: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  const sortedTechs = [...techs].sort(
    (a, b) => (seniorityOrder[a.seniority] ?? 3) - (seniorityOrder[b.seniority] ?? 3),
  );

  const flags: string[] = [];

  for (const tech of sortedTechs) {
    const techJobs = (jobsByTech.get(tech.id) ?? []).sort((a, b) =>
      a.time.localeCompare(b.time),
    );
    lines.push(`${tech.name} (${tech.seniority[0].toUpperCase()}${tech.seniority.slice(1)}):`);
    if (techJobs.length === 0) {
      lines.push("  No jobs scheduled");
    } else {
      for (const job of techJobs) {
        const customer = customers.find((c) => c.id === job.customerId);
        const tierLabel = customer ? `Tier ${customer.tier}` : "";
        const bumpLabel = job.bumpable ? "bumpable" : "NOT bumpable";
        const durationNote = job.durationHrs >= 3 ? `, ${job.durationHrs}-hour job` : "";
        lines.push(
          `  ${formatTime(job.time)} — ${customer?.name ?? job.customerId} ${job.type} (${tierLabel}, ${bumpLabel}${durationNote})`,
        );
      }
    }
    lines.push("");

    // Flag: fully booked with no flex
    const totalHrs = techJobs.reduce((sum, j) => sum + j.durationHrs, 0);
    if (totalHrs >= 6.5) {
      const lastJob = techJobs[techJobs.length - 1];
      const lastCustomer = lastJob ? customers.find((c) => c.id === lastJob.customerId) : null;
      const firstTime = formatTime(techJobs[0]?.time ?? "08:00");
      const endTime = formatTime(computeEndTime(lastJob.time, lastJob.durationHrs));
      flags.push(
        `${tech.name} is booked solid ${firstTime}-${endTime} with no flex — if a job runs long, ${lastCustomer?.name ?? "the last customer"} gets bumped`,
      );
    }

    // Flag: only one job — available for reassignment
    if (techJobs.length === 1) {
      const endTime = formatTime(computeEndTime(techJobs[0].time, techJobs[0].durationHrs));
      flags.push(
        `${tech.name} has only one job — available for reassignment if needed after ${endTime}`,
      );
    }

    // Flag: non-bumpable long jobs that block a tech
    for (const job of techJobs) {
      if (!job.bumpable && job.durationHrs >= 3) {
        const endTime = formatTime(computeEndTime(job.time, job.durationHrs));
        const customer = customers.find((c) => c.id === job.customerId);
        flags.push(
          `${customer?.name ?? job.customerId} ${job.type.toLowerCase()} is non-interruptible — plan around ${tech.name} being unavailable until ${endTime}`,
        );
      }
    }
  }

  // Flex buffer status
  lines.push("FLEX BUFFERS:");
  for (const slot of schedule.flexSlots) {
    const icon = slot.status === "available" ? "✅" : "❌";
    const label = slot.time < "12:00" ? "Morning" : "Afternoon";
    lines.push(`  ${icon} ${label} (${formatTime(slot.time)}): ${slot.status === "available" ? "Available" : "Consumed"}`);
  }

  const consumedFlex = schedule.flexSlots.filter((s) => s.status === "consumed");
  if (consumedFlex.length > 0) {
    flags.push(
      `${consumedFlex.length} flex buffer(s) already consumed — emergency capacity reduced`,
    );
  }
  if (consumedFlex.length >= schedule.flexSlots.length) {
    flags.push("ALL flex buffers consumed — zero emergency capacity for the day");
  }

  // Flags section
  if (flags.length > 0) {
    lines.push("");
    lines.push("⚠️ FLAGS:");
    for (const flag of flags) {
      lines.push(`  • ${flag}`);
    }
  }

  // Customer notes — Tier 1 VIPs and follow-up reminders
  const todaysCustomerIds = new Set(schedule.jobs.map((j) => j.customerId));
  const todaysCustomers = customers.filter((c) => todaysCustomerIds.has(c.id));

  const customerNotes: string[] = [];

  for (const customer of todaysCustomers) {
    if (customer.tier === 1) {
      const years = customer.customerSince
        ? Math.floor((Date.now() - new Date(customer.customerSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0;
      const parts = [`${customer.name} (Tier 1): ${years}-year customer`];
      if (customer.referralCount > 0) {
        parts.push(`${customer.referralCount} referral${customer.referralCount > 1 ? "s" : ""}`);
      }
      parts.push("treat with care");
      customerNotes.push(parts.join(", "));
    }
    // Follow-up reminder for recent work
    if (customer.lastJobDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(customer.lastJobDate).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysSince <= 7 && daysSince >= 1) {
        const job = schedule.jobs.find((j) => j.customerId === customer.id);
        if (job) {
          customerNotes.push(
            `${customer.name}: Had ${customer.lastJobType} ${daysSince} day(s) ago — follow up to check if everything's running smoothly`,
          );
        }
      }
    }
  }

  if (customerNotes.length > 0) {
    lines.push("");
    lines.push("CUSTOMER NOTES:");
    for (const note of customerNotes) {
      lines.push(`  • ${note}`);
    }
  }

  // Upcoming reminders
  const reminderSummary = getUpcomingRemindersSummary(7);
  lines.push("");
  lines.push(reminderSummary);

  const availableFlex = schedule.flexSlots.filter((s) => s.status === "available");
  const activeJobs = schedule.jobs.filter((j) => j.status === "scheduled" || j.status === "in_progress").length;
  const activeReminderCount = getReminders({ status: "active" }).length;
  const action = `${availableFlex.length} flex slot(s) available. ${activeJobs} jobs scheduled. ${activeReminderCount} active reminder(s).`;

  return { body: lines.join("\n"), action };
}

/**
 * Generate a per-tech morning schedule view.
 * Shows only that tech's jobs with practical, friendly details — no strategy.
 */
export function generateTechMorningSchedule(techId: string): string | null {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const tech = techs.find((t) => t.id === techId);
  if (!tech) return null;

  const techJobs = schedule.jobs
    .filter((j) => j.techId === techId && (j.status === "scheduled" || j.status === "in_progress"))
    .sort((a, b) => a.time.localeCompare(b.time));

  const dayName = getDayName(schedule.date);

  const lines: string[] = [];
  lines.push(`☀️ Good morning ${tech.name} — here's your ${dayName}:`);
  lines.push("");

  if (techJobs.length === 0) {
    lines.push("  No jobs scheduled today. Stand by for dispatch.");
  } else {
    for (const job of techJobs) {
      const customer = customers.find((c) => c.id === job.customerId);
      const customerName = customer?.name ?? job.customerId;

      lines.push(`  ${formatTime(job.time)} — ${customerName}, ${job.type} (${job.address})`);

      // Add friendly customer notes (not strategic tier info)
      const notes: string[] = [];
      if (customer) {
        if (customer.tier === 1) {
          const years = customer.customerSince
            ? Math.floor((Date.now() - new Date(customer.customerSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : 0;
          if (years > 0) {
            notes.push(`⭐ VIP customer — ${years} years with us.`);
          }
          if (customer.notes) {
            notes.push(customer.notes);
          }
        } else if (customer.tier === 3 && customer.jobCount === 0) {
          notes.push("New customer, first time. Make a good impression.");
        } else if (customer.notes) {
          notes.push(customer.notes);
        }
      }

      if (job.bumpable) {
        notes.push("Bumpable if emergency.");
      }

      for (const note of notes) {
        lines.push(`           ${note}`);
      }
    }
  }

  lines.push("");
  const jobCount = techJobs.length;
  lines.push(`${jobCount} job${jobCount !== 1 ? "s" : ""} today. Have a good one.`);

  return lines.join("\n");
}

/**
 * Generate a CEO daily summary from current operational state.
 */
export function generateDailyCeoSummary(): string {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const completedJobs = schedule.jobs.filter((j) => j.status === "completed");
  const emergencyJobs = schedule.jobs.filter(
    (j) => j.type.toLowerCase().includes("emergency") || j.type.toLowerCase().includes("burst") || j.type.toLowerCase().includes("leak"),
  );
  const activeJobs = schedule.jobs.filter((j) => j.status === "scheduled" || j.status === "in_progress");

  // Estimate revenue from completed jobs
  let revenueEstimate = 0;
  for (const job of completedJobs) {
    // Rough revenue estimate based on duration
    revenueEstimate += job.durationHrs * 200;
  }
  // Also include active jobs as planned revenue
  for (const job of activeJobs) {
    revenueEstimate += job.durationHrs * 200;
  }

  // Tech utilization
  const techLines: string[] = [];
  for (const tech of techs) {
    const techJobs = schedule.jobs.filter(
      (j) => j.techId === tech.id && (j.status === "scheduled" || j.status === "in_progress" || j.status === "completed"),
    );
    const totalHrs = techJobs.reduce((sum, j) => sum + j.durationHrs, 0);
    const utilization = Math.min(100, Math.round((totalHrs / 8) * 100));
    techLines.push(`  ${tech.name}: ${utilization}% (${techJobs.length} job${techJobs.length !== 1 ? "s" : ""})`);
  }

  // New customers today
  const todayCustomerIds = new Set(schedule.jobs.map((j) => j.customerId));
  const newCustomers = customers.filter((c) => todayCustomerIds.has(c.id) && c.tier === 3 && c.jobCount <= 1);

  const lines: string[] = [];
  lines.push(`📊 DAILY SUMMARY — ${formatDate(schedule.date)}`);
  lines.push("");
  lines.push(`REVENUE: ~$${revenueEstimate.toLocaleString()} across ${completedJobs.length + activeJobs.length} jobs`);
  lines.push(`EMERGENCIES: ${emergencyJobs.length}${emergencyJobs.length > 0 ? " (see ops log for details)" : ""}`);
  lines.push(`NEW CUSTOMERS: ${newCustomers.length}`);
  lines.push("");
  lines.push("TECH UTILIZATION:");
  lines.push(techLines.join("\n"));
  lines.push("");

  // Flags
  const flags: string[] = [];
  const consumedFlex = schedule.flexSlots.filter((s) => s.status === "consumed");
  if (consumedFlex.length > 0) {
    flags.push("Flex buffer(s) consumed. Recommend rebuilding tomorrow.");
  }
  for (const tech of techs) {
    const techJobs = schedule.jobs.filter(
      (j) => j.techId === tech.id && (j.status === "scheduled" || j.status === "in_progress"),
    );
    const totalHrs = techJobs.reduce((sum, j) => sum + j.durationHrs, 0);
    if (totalHrs < 3 && techJobs.length > 0) {
      flags.push(`${tech.name} had light load — consider loading more tomorrow.`);
    }
  }

  if (flags.length > 0) {
    lines.push("FLAGS:");
    for (const flag of flags) {
      lines.push(`  • ${flag}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate a CEO weekly summary from current operational state.
 */
export function generateWeeklyCeoSummary(): string {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const totalJobs = schedule.jobs.length;
  const completedJobs = schedule.jobs.filter((j) => j.status === "completed").length;
  const emergencyJobs = schedule.jobs.filter(
    (j) => j.type.toLowerCase().includes("emergency") || j.type.toLowerCase().includes("burst") || j.type.toLowerCase().includes("leak"),
  ).length;

  // Rough weekly revenue estimate
  const weeklyRevenue = schedule.jobs.reduce((sum, j) => sum + j.durationHrs * 200, 0);

  const newCustomers = customers.filter((c) => c.tier === 3 && c.jobCount <= 1);
  const referrals = customers.reduce((sum, c) => sum + c.referralCount, 0);

  const lines: string[] = [];
  const schedDate = new Date(schedule.date + "T00:00:00");
  const weekStart = new Date(schedDate);
  weekStart.setDate(schedDate.getDate() - schedDate.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);

  lines.push(`📈 WEEKLY SUMMARY — Week of ${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekStart.getFullYear()}`);
  lines.push("");
  lines.push(`REVENUE: ~$${weeklyRevenue.toLocaleString()} (projected from today's schedule)`);
  lines.push(`JOBS: ${totalJobs} scheduled, ${completedJobs} completed`);
  lines.push(`EMERGENCIES: ${emergencyJobs}`);
  lines.push(`CUSTOMER RETENTION: ${customers.filter((c) => c.tier <= 2).length} active regulars/VIPs`);
  lines.push(`NEW CUSTOMERS: ${newCustomers.length}`);
  lines.push(`TOTAL REFERRALS ON FILE: ${referrals}`);
  lines.push("");

  // Trends / risks
  const lines2: string[] = [];
  const fullyBookedTechs = techs.filter((t) => {
    const jobs = schedule.jobs.filter((j) => j.techId === t.id && (j.status === "scheduled" || j.status === "in_progress"));
    return jobs.reduce((sum, j) => sum + j.durationHrs, 0) >= 7;
  });
  if (fullyBookedTechs.length > 0) {
    lines2.push(`${fullyBookedTechs.map((t) => t.name).join(", ")} fully booked — one overrun away from cascade. Consider: hiring discussion if this pattern holds.`);
  }

  const highCallbackTechs = techs.filter((t) => t.metrics.avgCallbackRate > 0.06);
  if (highCallbackTechs.length > 0) {
    for (const t of highCallbackTechs) {
      lines2.push(`${t.name} callback rate at ${(t.metrics.avgCallbackRate * 100).toFixed(0)}% — monitor and consider mentorship pairing.`);
    }
  }

  if (lines2.length > 0) {
    lines.push("TRENDS / RISKS:");
    for (const l of lines2) {
      lines.push(`  • ${l}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate a clean schedule view for /schedule command.
 * Shows current state of all jobs and tech statuses.
 */
export function generateScheduleView(): string {
  const schedule = getSchedule();
  const techs = getTechs();
  const customers = getCustomers();

  const lines: string[] = [];
  lines.push(`📅 SCHEDULE — ${formatDate(schedule.date)}`);
  lines.push("");

  // Sort techs by seniority
  const seniorityOrder: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  const sortedTechs = [...techs].sort(
    (a, b) => (seniorityOrder[a.seniority] ?? 3) - (seniorityOrder[b.seniority] ?? 3),
  );

  for (const tech of sortedTechs) {
    const statusIcon = tech.status === "available" ? "🟢" :
      tech.status === "en_route" ? "🚗" :
      tech.status === "on_job" ? "🔧" :
      tech.status === "off_duty" ? "⚫" : "⚪";

    lines.push(`${statusIcon} ${tech.name} (${tech.seniority}) — ${tech.status}`);

    const techJobs = schedule.jobs
      .filter((j) => j.techId === tech.id)
      .sort((a, b) => a.time.localeCompare(b.time));

    if (techJobs.length === 0) {
      lines.push("  No jobs");
    } else {
      for (const job of techJobs) {
        const customer = customers.find((c) => c.id === job.customerId);
        const name = customer?.name ?? job.customerId;
        const statusTag =
          job.status === "completed" ? "✅" :
          job.status === "in_progress" ? "▶️" :
          job.status === "paused" ? "⏸️" :
          job.status === "rescheduled" ? "🔄" :
          job.status === "cancelled" ? "❌" : "⏳";
        const endTime = computeEndTime(job.time, job.durationHrs);
        lines.push(`  ${statusTag} ${formatTime(job.time)}-${formatTime(endTime)} ${name} — ${job.type}`);
      }
    }
    lines.push("");
  }

  // Flex buffer status
  lines.push("FLEX BUFFERS:");
  for (const slot of schedule.flexSlots) {
    const icon = slot.status === "available" ? "✅" : "❌";
    const label = slot.time < "12:00" ? "AM" : "PM";
    lines.push(`  ${icon} ${label} (${formatTime(slot.time)}): ${slot.status}`);
  }

  return lines.join("\n");
}

/**
 * Post the morning schedule briefing to the ops group.
 * Called on bot startup or via the /morning command.
 * Also sends per-tech schedules to each tech's channel.
 */
export async function postMorningBriefing(): Promise<void> {
  const { body, action } = generateMorningBriefing();

  // Post full ops briefing
  await postToOpsFormatted({
    title: "MORNING BRIEFING",
    body,
    action,
  });

  // Post per-tech schedules to each tech channel
  const techChannels = getTechChannels();
  for (const channel of techChannels) {
    try {
      const techSchedule = generateTechMorningSchedule(channel.techId);
      if (techSchedule) {
        await postToTech(channel.techId, techSchedule);
      }
    } catch (err) {
      console.error(`[startup] Failed to post morning schedule to ${channel.techId}:`, err);
    }
  }
}
