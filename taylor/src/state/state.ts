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

function loadAll(): void {
  techs = deepClone(loadJson<Tech[]>("techs.json"));
  customers = deepClone(loadJson<Customer[]>("customers.json"));
  schedule = deepClone(loadJson<Schedule>("schedule.json"));
  jobsCatalog = deepClone(loadJson<JobsCatalog>("jobs-catalog.json"));
  serviceArea = deepClone(loadJson<DriveTimeEntry[]>("service-area.json"));
  policies = deepClone(loadJson<Policies>("policies.json"));
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

// --- Reset ---

export function resetToDefault(): void {
  loadAll();
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

  return lines.join("\n");
}
