import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getReminders,
  createReminder,
  getNextReminder,
  triggerReminder,
  snoozeReminder,
  cancelReminder,
  getDueReminders,
  type Reminder,
} from '../state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', '..', '..', 'state');

function resetReminders(reminders: Reminder[] = []): void {
  writeFileSync(
    join(STATE_DIR, 'reminders.json'),
    JSON.stringify(reminders, null, 2),
    'utf-8',
  );
}

const sampleReminder: Reminder = {
  id: 'rem-test-1',
  createdAt: '2026-03-14T10:00:00Z',
  createdBy: { role: 'customer', id: 'garcia' },
  targetChannel: 'customer',
  targetId: 'garcia',
  triggerAt: '2026-03-16T09:00:00Z',
  message: 'Time for your water heater flush!',
  context: 'Annual maintenance reminder',
  status: 'active',
  customerId: 'garcia',
};

describe('Reminder CRUD', () => {
  beforeEach(() => {
    resetReminders();
  });

  it('creates and retrieves a reminder', () => {
    createReminder(sampleReminder);
    const reminders = getReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe('rem-test-1');
    expect(reminders[0].message).toBe('Time for your water heater flush!');
  });

  it('filters reminders by status', () => {
    createReminder(sampleReminder);
    createReminder({
      ...sampleReminder,
      id: 'rem-test-2',
      status: 'cancelled',
    });

    const active = getReminders({ status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('rem-test-1');
  });

  it('filters reminders by targetId', () => {
    createReminder(sampleReminder);
    createReminder({
      ...sampleReminder,
      id: 'rem-test-2',
      targetId: 'chen',
      customerId: 'chen',
    });

    const garciaReminders = getReminders({ targetId: 'garcia' });
    expect(garciaReminders).toHaveLength(1);
    expect(garciaReminders[0].customerId).toBe('garcia');
  });

  it('filters reminders by beforeDate', () => {
    createReminder(sampleReminder);
    createReminder({
      ...sampleReminder,
      id: 'rem-test-2',
      triggerAt: '2026-04-01T08:00:00Z',
    });

    const beforeMarch17 = getReminders({ beforeDate: '2026-03-17T00:00:00Z' });
    expect(beforeMarch17).toHaveLength(1);
    expect(beforeMarch17[0].id).toBe('rem-test-1');
  });

  it('gets the next reminder for a target', () => {
    createReminder(sampleReminder);
    createReminder({
      ...sampleReminder,
      id: 'rem-test-2',
      triggerAt: '2026-04-16T09:00:00Z',
    });

    const next = getNextReminder('garcia');
    expect(next).not.toBeNull();
    expect(next!.id).toBe('rem-test-1');
  });

  it('returns null when no active reminders for target', () => {
    const next = getNextReminder('garcia');
    expect(next).toBeNull();
  });

  it('cancels a reminder', () => {
    createReminder(sampleReminder);
    cancelReminder('rem-test-1');

    const reminders = getReminders();
    expect(reminders[0].status).toBe('cancelled');
  });

  it('snoozes a reminder', () => {
    createReminder(sampleReminder);
    snoozeReminder('rem-test-1', '2026-03-20T09:00:00Z');

    const reminders = getReminders();
    expect(reminders[0].status).toBe('snoozed');
    expect(reminders[0].snoozedUntil).toBe('2026-03-20T09:00:00Z');
    expect(reminders[0].triggerAt).toBe('2026-03-20T09:00:00Z');
  });

  it('triggers a non-recurring reminder', () => {
    createReminder(sampleReminder);
    triggerReminder('rem-test-1');

    const reminders = getReminders();
    expect(reminders[0].status).toBe('triggered');
  });

  it('triggers a recurring reminder and advances to next occurrence', () => {
    const recurring: Reminder = {
      ...sampleReminder,
      recurrence: { interval: 'yearly' },
    };
    createReminder(recurring);
    triggerReminder('rem-test-1');

    const reminders = getReminders();
    // Status should remain active (advanced to next occurrence)
    expect(reminders[0].status).toBe('active');
    // triggerAt should be advanced by ~1 year
    const newTrigger = new Date(reminders[0].triggerAt);
    expect(newTrigger.getFullYear()).toBe(2027);
  });

  it('triggers a monthly recurring reminder', () => {
    const recurring: Reminder = {
      ...sampleReminder,
      recurrence: { interval: 'monthly' },
    };
    createReminder(recurring);
    triggerReminder('rem-test-1');

    const reminders = getReminders();
    const newTrigger = new Date(reminders[0].triggerAt);
    expect(newTrigger.getMonth()).toBe(new Date('2026-03-16T09:00:00Z').getMonth() + 1);
  });
});

describe('getDueReminders', () => {
  beforeEach(() => {
    resetReminders();
  });

  it('returns reminders that are due', () => {
    createReminder(sampleReminder);
    // sampleReminder triggerAt is 2026-03-16, check as of 2026-03-17
    const due = getDueReminders('2026-03-17T00:00:00Z');
    expect(due).toHaveLength(1);
  });

  it('does not return future reminders', () => {
    createReminder(sampleReminder);
    // Check as of 2026-03-15 (before trigger)
    const due = getDueReminders('2026-03-15T00:00:00Z');
    expect(due).toHaveLength(0);
  });

  it('returns snoozed reminders past their snooze time', () => {
    const snoozed: Reminder = {
      ...sampleReminder,
      status: 'snoozed',
      snoozedUntil: '2026-03-16T09:00:00Z',
    };
    createReminder(snoozed);
    const due = getDueReminders('2026-03-17T00:00:00Z');
    expect(due).toHaveLength(1);
  });

  it('does not return cancelled or triggered reminders', () => {
    createReminder({ ...sampleReminder, id: 'rem-cancelled', status: 'cancelled' });
    createReminder({ ...sampleReminder, id: 'rem-triggered', status: 'triggered' });
    const due = getDueReminders('2026-03-17T00:00:00Z');
    expect(due).toHaveLength(0);
  });
});
