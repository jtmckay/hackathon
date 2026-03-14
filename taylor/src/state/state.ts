import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  Tech,
  TechStatus,
  Customer,
  Schedule,
  ScheduledJob,
  FlexSlot,
  JobsCatalog,
  DriveTimeEntry,
  Policies,
  JobStatus,
  ServiceEvent,
  Reminder,
  ReminderStatus,
} from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

function loadJson<T>(filename: string): T {
  const raw = readFileSync(join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

let techs: Tech[];
let customers: Customer[];
let schedule: Schedule;
let jobsCatalog: JobsCatalog;
let serviceArea: DriveTimeEntry[];
let policies: Policies;
let reminders: Reminder[];

function loadAll(): void {
  techs = deepClone(loadJson<Tech[]>("techs.json"));
  customers = deepClone(loadJson<Customer[]>("customers.json"));
  schedule = deepClone(loadJson<Schedule>("schedule.json"));
  jobsCatalog = deepClone(loadJson<JobsCatalog>("jobs-catalog.json"));
  serviceArea = deepClone(loadJson<DriveTimeEntry[]>("service-area.json"));
  policies = deepClone(loadJson<Policies>("policies.json"));
  reminders = deepClone(loadJson<Reminder[]>("reminders.json"));
}

// Initialize on import
loadAll();

// --- Read accessors ---

export function getTechs(): Tech[] {
  return techs;
}

export function getCustomers(): Customer[] {
  return customers;
}

export function getSchedule(): Schedule {
  return schedule;
}

export function getJobsCatalog(): JobsCatalog {
  return jobsCatalog;
}

export function getServiceArea(): DriveTimeEntry[] {
  return serviceArea;
}

export function getPolicies(): Policies {
  return policies;
}

// --- Query helpers ---

export function getTechById(id: string): Tech | undefined {
  return techs.find((t) => t.id === id);
}

export function getCustomerById(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}

export function getJobsByTech(techId: string): ScheduledJob[] {
  return schedule.jobs.filter((j) => j.techId === techId);
}

export function getUpcomingJobsByTech(techId: string): ScheduledJob[] {
  return schedule.jobs.filter(
    (j) => j.techId === techId && (j.status === "scheduled" || j.status === "in_progress")
  );
}

export function getCustomerTier(customerId: string): 1 | 2 | 3 | undefined {
  const customer = customers.find((c) => c.id === customerId);
  return customer?.tier;
}

export function getDriveTime(from: string, to: string): number | undefined {
  if (from === to) return 0;
  const entry = serviceArea.find(
    (e) =>
      (e.from === from && e.to === to) ||
      (e.from === to && e.to === from)
  );
  return entry?.minutes;
}

export function getFlexSlots(): FlexSlot[] {
  return schedule.flexSlots.filter((s) => s.status === "available");
}

// --- Mutation methods ---

export function updateTechStatus(
  techId: string,
  status: TechStatus,
  currentJobId?: number | null
): void {
  const tech = techs.find((t) => t.id === techId);
  if (!tech) throw new Error(`Tech not found: ${techId}`);
  tech.status = status;
  if (currentJobId !== undefined) {
    tech.currentJobId = currentJobId;
  }
}

export function updateJobStatus(jobId: number, status: JobStatus): void {
  const job = schedule.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  job.status = status;
}

export function addJobToSchedule(job: ScheduledJob): void {
  schedule.jobs.push(job);
}

export function removeJobFromSchedule(jobId: number): void {
  const idx = schedule.jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) throw new Error(`Job not found: ${jobId}`);
  schedule.jobs.splice(idx, 1);
}

export function reassignJob(
  jobId: number,
  newTechId: string,
  newTime?: string
): void {
  const job = schedule.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  job.techId = newTechId;
  if (newTime !== undefined) {
    job.time = newTime;
  }
}

export function consumeFlexSlot(slotId: string): void {
  const slot = schedule.flexSlots.find((s) => s.id === slotId);
  if (!slot) throw new Error(`Flex slot not found: ${slotId}`);
  slot.status = "consumed";
}

// --- Customer management ---

export function addCustomer(customer: Customer): void {
  customers.push(customer);
}

export function getCustomerByAddress(address: string): Customer | undefined {
  const normalized = address.toLowerCase().trim();
  return customers.find((c) => c.address.toLowerCase().trim() === normalized);
}

export function getCustomerByName(name: string): Customer | undefined {
  const normalized = name.toLowerCase().trim();
  return customers.find((c) => c.name.toLowerCase().trim() === normalized);
}

// --- Service Event Ledger ---

export function appendServiceEvent(
  customerId: string,
  event: ServiceEvent
): void {
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) throw new Error(`Customer not found: ${customerId}`);
  if (!customer.serviceHistory) {
    customer.serviceHistory = [];
  }
  customer.serviceHistory.push(event);
}

export function getServiceHistory(customerId: string): ServiceEvent[] {
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) throw new Error(`Customer not found: ${customerId}`);
  return customer.serviceHistory ?? [];
}

export function getRecentHistory(
  customerId: string,
  count: number
): ServiceEvent[] {
  const history = getServiceHistory(customerId);
  return history.slice(-count);
}

// --- Reminder CRUD ---

export function getReminders(filter?: {
  role?: string;
  targetId?: string;
  status?: ReminderStatus;
  beforeDate?: string;
}): Reminder[] {
  let result = reminders;
  if (filter?.role) {
    result = result.filter((r) => r.createdBy.role === filter.role);
  }
  if (filter?.targetId) {
    result = result.filter((r) => r.targetId === filter.targetId);
  }
  if (filter?.status) {
    result = result.filter((r) => r.status === filter.status);
  }
  if (filter?.beforeDate) {
    result = result.filter((r) => r.triggerAt <= filter.beforeDate!);
  }
  return result;
}

export function getNextReminder(targetId: string): Reminder | undefined {
  return reminders
    .filter((r) => r.targetId === targetId && r.status === "active")
    .sort((a, b) => a.triggerAt.localeCompare(b.triggerAt))[0];
}

export function getDueReminders(asOf?: string): Reminder[] {
  const now = asOf ?? new Date().toISOString();
  return reminders.filter(
    (r) => r.status === "active" && r.triggerAt <= now,
  );
}

export function createReminder(reminder: Reminder): void {
  reminders.push(reminder);
}

export function triggerReminder(id: string): void {
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) throw new Error(`Reminder not found: ${id}`);

  if (reminder.recurrence) {
    // Advance to next occurrence
    const trigger = new Date(reminder.triggerAt);
    switch (reminder.recurrence.interval) {
      case "daily":
        trigger.setDate(trigger.getDate() + 1);
        break;
      case "weekly":
        trigger.setDate(trigger.getDate() + 7);
        break;
      case "monthly":
        trigger.setMonth(trigger.getMonth() + 1);
        break;
      case "yearly":
        trigger.setFullYear(trigger.getFullYear() + 1);
        break;
      case "custom":
        trigger.setDate(trigger.getDate() + (reminder.recurrence.customDays ?? 30));
        break;
    }

    // Check if recurrence has ended
    if (reminder.recurrence.endAfter && trigger.toISOString() > reminder.recurrence.endAfter) {
      reminder.status = "triggered";
    } else {
      reminder.triggerAt = trigger.toISOString();
      // Stays active for next occurrence
    }
  } else {
    reminder.status = "triggered";
  }
}

export function snoozeReminder(id: string, until: string): void {
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) throw new Error(`Reminder not found: ${id}`);
  reminder.status = "snoozed";
  reminder.snoozedUntil = until;
  reminder.triggerAt = until;
  reminder.status = "active"; // Re-activate with new trigger date
}

export function cancelReminder(id: string): void {
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) throw new Error(`Reminder not found: ${id}`);
  reminder.status = "cancelled";
}

export function getReminderById(id: string): Reminder | undefined {
  return reminders.find((r) => r.id === id);
}

// --- Reset ---

type ResetHook = () => void;
const resetHooks: ResetHook[] = [];

/**
 * Register a callback to be invoked whenever resetToDefault() is called.
 * Used to clear conversation history without creating circular imports.
 */
export function onReset(hook: ResetHook): void {
  resetHooks.push(hook);
}

export function resetToDefault(): void {
  loadAll();
  for (const hook of resetHooks) {
    hook();
  }
}

// --- State snapshot for system prompt injection ---

export function getStateSnapshot(): string {
  const lines: string[] = [];

  lines.push(`=== SHAMROCK PLUMBING — OPERATIONAL STATE ===`);
  lines.push(`Date: ${schedule.date}`);
  lines.push("");

  lines.push("--- TECH ROSTER ---");
  for (const tech of techs) {
    const currentJob = tech.currentJobId
      ? schedule.jobs.find((j) => j.id === tech.currentJobId)
      : null;
    lines.push(
      `${tech.name} (${tech.seniority}, ${tech.years}yr) — Status: ${tech.status}${currentJob ? ` [Job #${currentJob.id}: ${currentJob.type} @ ${currentJob.address}]` : ""}`
    );
    lines.push(
      `  Location: ${tech.currentLocation} | Specialties: ${tech.specialties.join(", ")}`
    );
    lines.push(
      `  Certs: ${tech.certifications.length > 0 ? tech.certifications.join(", ") : "none"} | Rating: ${tech.metrics.avgRating} | Callback rate: ${(tech.metrics.avgCallbackRate * 100).toFixed(0)}%`
    );
    lines.push(`  Notes: ${tech.notes}`);
  }
  lines.push("");

  lines.push("--- TODAY'S SCHEDULE ---");
  const sortedJobs = [...schedule.jobs].sort((a, b) =>
    a.time.localeCompare(b.time)
  );
  for (const job of sortedJobs) {
    const tech = techs.find((t) => t.id === job.techId);
    lines.push(
      `${job.time} — ${tech?.name ?? job.techId}: ${job.type} for ${job.customerId} @ ${job.address} (${job.durationHrs}hr, ${job.status}${job.bumpable ? ", bumpable" : ""})`
    );
  }
  lines.push("");

  const availableFlex = schedule.flexSlots.filter(
    (s) => s.status === "available"
  );
  lines.push(`--- FLEX BUFFERS (${availableFlex.length} available) ---`);
  for (const slot of schedule.flexSlots) {
    lines.push(
      `${slot.time} — ${slot.id}: ${slot.status} (${slot.duration_hrs}hr) — ${slot.notes}`
    );
  }
  lines.push("");

  lines.push("--- PENDING/UPCOMING JOBS ---");
  const pending = schedule.jobs.filter(
    (j) => j.status === "scheduled" || j.status === "in_progress"
  );
  lines.push(`${pending.length} active/upcoming jobs`);
  lines.push("");

  // Active reminders
  const activeReminders = reminders.filter((r) => r.status === "active");
  lines.push(`--- ACTIVE REMINDERS (${activeReminders.length}) ---`);
  const sortedReminders = [...activeReminders].sort((a, b) =>
    a.triggerAt.localeCompare(b.triggerAt),
  );
  for (const r of sortedReminders.slice(0, 10)) {
    const triggerDate = r.triggerAt.split("T")[0];
    const target = r.targetId ?? r.targetChannel;
    lines.push(
      `${triggerDate} → ${target}: ${r.message.slice(0, 80)}${r.message.length > 80 ? "..." : ""} (${r.id})`,
    );
  }
  if (activeReminders.length > 10) {
    lines.push(`... and ${activeReminders.length - 10} more`);
  }

  return lines.join("\n");
}
