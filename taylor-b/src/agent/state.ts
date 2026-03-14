import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StateUpdate } from './directives.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const STATE_DIR = join(ROOT, 'state');

export interface Tech {
  id: string;
  name: string;
  seniority: string;
  years: number;
  specialties: string[];
  certifications: string[];
  status: string;
  currentLocation: string;
  currentJobId: string | null;
  metrics: {
    avgRating: number;
    jobsCompleted: number;
    emergencyCount: number;
    callbackRate: number;
  };
}

export interface Complaint {
  date: string;
  jobType: string;
  complaint: string;
  resolution: string;
  costToShamrock: number;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  tier: number;
  customerSince: string | null;
  jobCount: number;
  referralCount: number;
  lifetimeValue: number;
  lastJobDate: string | null;
  lastJobType: string | null;
  notes: string;
  complaintHistory: Complaint[];
  communicationPreference: string;
  paymentHistory: string | null;
  serviceHistory?: ServiceEvent[];
}

export interface Job {
  id: number | string;
  techId: string;
  time: string;
  type: string;
  customerId: string;
  address: string;
  durationHrs: number;
  bumpable: boolean;
  notes: string;
  status: string;
}

export interface FlexSlot {
  id: string;
  time: string;
  type: string;
  duration_hrs: number;
  status: string;
  notes: string;
}

export interface Schedule {
  date: string;
  day: string;
  jobs: Job[];
  flexSlots: FlexSlot[];
}

export interface ServiceEvent {
  id: string;
  timestamp: string;
  type:
    | 'intake'
    | 'dispatch'
    | 'tech_assigned'
    | 'schedule_change'
    | 'tech_update'
    | 'completion'
    | 'feedback'
    | 'complaint'
    | 'resolution'
    | 'follow_up'
    | 'note'
    | 'warranty_claim'
    | 'referral'
    | 'communication';
  channel: 'customer' | 'ops' | 'tech' | 'system';
  summary: string;
  details?: string;
  techId?: string;
  jobType?: string;
  resolution?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'distressed';
  agentReasoning?: string;
}

export interface Reminder {
  id: string;
  createdAt: string;
  createdBy: {
    role: 'customer' | 'ops' | 'tech' | 'ceo' | 'system';
    id: string;
  };
  targetChannel: 'customer' | 'ops' | 'tech' | 'ceo';
  targetId?: string;
  triggerAt: string;
  recurrence?: {
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    customDays?: number;
    endAfter?: string;
  };
  message: string;
  context: string;
  status: 'active' | 'triggered' | 'snoozed' | 'cancelled';
  snoozedUntil?: string;
  jobId?: string;
  customerId?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DATA_DIR = join(ROOT, 'data');

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(STATE_DIR, filename), 'utf-8'));
}

function writeJson(filename: string, data: unknown): void {
  writeFileSync(join(STATE_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

export function getTechs(): Tech[] {
  return readJson<Tech[]>('techs.json');
}

export function getCustomers(): Customer[] {
  return readJson<Customer[]>('customers.json');
}

export function getSchedule(): Schedule {
  return readJson<Schedule>('schedule.json');
}

/**
 * Channel can be 'customer', 'ops', or 'tech:<techId>' (e.g. 'tech:marcus').
 */
export type ChannelId = 'customer' | 'ops' | 'ceo' | `tech:${string}`;

function historyFilename(channel: ChannelId): string {
  return `history-${channel.replace(':', '-')}.json`;
}

export function getHistory(channel: ChannelId): ConversationMessage[] {
  try {
    return readJson<ConversationMessage[]>(historyFilename(channel));
  } catch {
    // Tech history files may not exist yet — return empty
    return [];
  }
}

export function appendHistory(
  channel: ChannelId,
  messages: ConversationMessage[],
): void {
  const history = getHistory(channel);
  history.push(...messages);
  writeJson(historyFilename(channel), history);
}

export function resetToDefault(): void {
  const filesToCopy = ['techs.json', 'customers.json', 'schedule.json'];
  for (const file of filesToCopy) {
    const src = readFileSync(join(DATA_DIR, file), 'utf-8');
    writeFileSync(join(STATE_DIR, file), src, 'utf-8');
  }
  // Reset reminders to seed data
  try {
    const reminderSeed = readFileSync(join(DATA_DIR, 'reminders.json'), 'utf-8');
    writeFileSync(join(STATE_DIR, 'reminders.json'), reminderSeed, 'utf-8');
  } catch {
    writeJson('reminders.json', []);
  }
  writeJson('history-customer.json', []);
  writeJson('history-ops.json', []);
  writeJson('history-ceo.json', []);
  // Clear per-tech conversation histories
  const techIds = ['marcus', 'tyler', 'jake', 'danny'];
  for (const techId of techIds) {
    writeJson(`history-tech-${techId}.json`, []);
  }
}

export function getCustomerById(customerId: string): Customer | undefined {
  const customers = getCustomers();
  return customers.find((c) => c.id === customerId);
}

export function appendServiceEvent(
  customerId: string,
  event: ServiceEvent,
): void {
  const customers = getCustomers();
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return;
  if (!customer.serviceHistory) {
    customer.serviceHistory = [];
  }
  customer.serviceHistory.push(event);
  writeJson('customers.json', customers);
}

export function getServiceHistory(customerId: string): ServiceEvent[] {
  const customer = getCustomerById(customerId);
  if (!customer?.serviceHistory) return [];
  return [...customer.serviceHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function getRecentHistory(
  customerId: string,
  count: number,
): ServiceEvent[] {
  const history = getServiceHistory(customerId);
  return history.slice(-count);
}

export function addCustomer(customer: Customer): void {
  const customers = getCustomers();
  customers.push(customer);
  writeJson('customers.json', customers);
}

export function updateCustomer(
  customerId: string,
  updates: Partial<Customer>,
): void {
  const customers = getCustomers();
  const idx = customers.findIndex((c) => c.id === customerId);
  if (idx === -1) return;
  customers[idx] = { ...customers[idx], ...updates };
  writeJson('customers.json', customers);
}

export function applyStateUpdate(update: StateUpdate): void {
  switch (update.action) {
    case 'update_tech_status': {
      const techs = getTechs();
      const tech = techs.find((t) => t.id === update.techId);
      if (tech) {
        tech.status = update.status as string;
        if (update.currentJobId !== undefined) {
          tech.currentJobId = update.currentJobId as string;
        }
        writeJson('techs.json', techs);
      }
      break;
    }

    case 'update_job_status': {
      const schedule = getSchedule();
      const job = schedule.jobs.find((j) => j.id === update.jobId);
      if (job) {
        job.status = update.status as string;
        writeJson('schedule.json', schedule);
      }
      break;
    }

    case 'consume_flex_slot': {
      const schedule = getSchedule();
      const slot = schedule.flexSlots.find((s) => s.id === update.slotId);
      if (slot) {
        slot.status = 'consumed';
        writeJson('schedule.json', schedule);
      }
      break;
    }

    case 'add_emergency_job': {
      const schedule = getSchedule();
      schedule.jobs.push(update.job as Job);
      writeJson('schedule.json', schedule);
      break;
    }

    case 'reassign_job': {
      const schedule = getSchedule();
      const job = schedule.jobs.find((j) => j.id === update.jobId);
      if (job) {
        job.techId = update.newTechId as string;
        if (update.newTime) {
          job.time = update.newTime as string;
        }
        job.status = 'reassigned';
        writeJson('schedule.json', schedule);
      }
      break;
    }

    case 'reschedule_job': {
      const schedule = getSchedule();
      const job = schedule.jobs.find((j) => j.id === update.jobId);
      if (job) {
        job.status = 'rescheduled';
        if (update.newTechId) {
          job.techId = update.newTechId as string;
        }
        if (update.newTime) {
          job.time = update.newTime as string;
        }
        // Store the new date in notes for tracking
        if (update.newDate) {
          job.notes = `Rescheduled to ${update.newDate} at ${update.newTime || job.time}${job.notes ? '. ' + job.notes : ''}`;
        }
        writeJson('schedule.json', schedule);
      }
      break;
    }

    case 'complete_job': {
      const techs = getTechs();
      const tech = techs.find((t) => t.id === update.techId);
      if (tech) {
        tech.status = 'available';
        tech.currentJobId = null;
        writeJson('techs.json', techs);
      }
      const schedule = getSchedule();
      const job = schedule.jobs.find(
        (j) => String(j.id) === String(update.jobId),
      );
      if (job) {
        job.status = 'completed';
        writeJson('schedule.json', schedule);
      }
      break;
    }

    default:
      console.warn(`Unknown state update action: ${update.action}`);
  }
}

// ── Reminder CRUD ──────────────────────────────────────────

export function getReminders(filter?: {
  role?: string;
  targetId?: string;
  status?: string;
  beforeDate?: string;
}): Reminder[] {
  let reminders: Reminder[];
  try {
    reminders = readJson<Reminder[]>('reminders.json');
  } catch {
    return [];
  }
  if (!filter) return reminders;
  return reminders.filter((r) => {
    if (filter.role && r.createdBy.role !== filter.role) return false;
    if (filter.targetId && r.targetId !== filter.targetId) return false;
    if (filter.status && r.status !== filter.status) return false;
    if (filter.beforeDate && r.triggerAt > filter.beforeDate) return false;
    return true;
  });
}

export function createReminder(reminder: Reminder): void {
  const reminders = getReminders();
  reminders.push(reminder);
  writeJson('reminders.json', reminders);
}

export function getNextReminder(targetId: string): Reminder | null {
  const active = getReminders({ targetId, status: 'active' });
  if (active.length === 0) return null;
  active.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));
  return active[0];
}

export function triggerReminder(id: string): void {
  const reminders = getReminders();
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) return;

  if (reminder.recurrence) {
    // Advance to next occurrence
    const next = advanceRecurrence(reminder.triggerAt, reminder.recurrence);
    if (reminder.recurrence.endAfter && next > reminder.recurrence.endAfter) {
      reminder.status = 'triggered';
    } else {
      reminder.triggerAt = next;
    }
  } else {
    reminder.status = 'triggered';
  }
  writeJson('reminders.json', reminders);
}

export function snoozeReminder(id: string, until: string): void {
  const reminders = getReminders();
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) return;
  reminder.status = 'snoozed';
  reminder.snoozedUntil = until;
  reminder.triggerAt = until;
  writeJson('reminders.json', reminders);
}

export function cancelReminder(id: string): void {
  const reminders = getReminders();
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) return;
  reminder.status = 'cancelled';
  writeJson('reminders.json', reminders);
}

export function getDueReminders(asOf?: string): Reminder[] {
  const now = asOf || new Date().toISOString();
  const reminders = getReminders();
  return reminders.filter(
    (r) => (r.status === 'active' || r.status === 'snoozed') && r.triggerAt <= now,
  );
}

function advanceRecurrence(
  currentTrigger: string,
  recurrence: NonNullable<Reminder['recurrence']>,
): string {
  const date = new Date(currentTrigger);
  switch (recurrence.interval) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'custom':
      date.setDate(date.getDate() + (recurrence.customDays || 30));
      break;
  }
  return date.toISOString();
}
