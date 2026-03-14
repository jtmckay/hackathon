import { describe, it, expect } from 'vitest';
import { parseDirectives } from '../directives.js';

describe('CEO and Reminder directives', () => {
  it('extracts POST_TO_CEO directive', () => {
    const input =
      'Summary posted. [POST_TO_CEO: 📊 DAILY SUMMARY — Revenue $3,450, 8 jobs completed] Done.';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Summary posted. Done.');
    expect(result.ceoMessages).toEqual([
      '📊 DAILY SUMMARY — Revenue $3,450, 8 jobs completed',
    ]);
  });

  it('extracts multiple POST_TO_CEO directives', () => {
    const input =
      '[POST_TO_CEO: Revenue milestone crossed] [POST_TO_CEO: Capacity warning — all techs booked 3 days running]';
    const result = parseDirectives(input);

    expect(result.ceoMessages).toHaveLength(2);
    expect(result.ceoMessages[0]).toBe('Revenue milestone crossed');
    expect(result.ceoMessages[1]).toBe(
      'Capacity warning — all techs booked 3 days running',
    );
  });

  it('extracts CREATE_REMINDER directive with JSON', () => {
    const input =
      'Reminder set! [CREATE_REMINDER: {"createdBy": {"role": "customer", "id": "garcia"}, "targetChannel": "customer", "targetId": "garcia", "triggerAt": "2026-09-16T09:00:00Z", "message": "Time for your water heater flush", "context": "Annual maintenance", "customerId": "garcia"}] You\'ll hear from us on September 16th.';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe(
      "Reminder set! You'll hear from us on September 16th.",
    );
    expect(result.reminderDirectives).toHaveLength(1);
    expect(result.reminderDirectives[0].targetChannel).toBe('customer');
    expect(result.reminderDirectives[0].targetId).toBe('garcia');
    expect(result.reminderDirectives[0].triggerAt).toBe('2026-09-16T09:00:00Z');
    expect(result.reminderDirectives[0].customerId).toBe('garcia');
  });

  it('extracts CREATE_REMINDER with recurrence', () => {
    const input =
      '[CREATE_REMINDER: {"createdBy": {"role": "system", "id": "system"}, "targetChannel": "ops", "targetId": "blake", "triggerAt": "2026-04-01T08:00:00Z", "recurrence": {"interval": "monthly"}, "message": "Review Danny callback rate", "context": "Monthly management review"}]';
    const result = parseDirectives(input);

    expect(result.reminderDirectives).toHaveLength(1);
    expect(result.reminderDirectives[0].recurrence).toEqual({
      interval: 'monthly',
    });
  });

  it('handles POST_TO_CEO alongside other directives', () => {
    const input =
      'All handled. [POST_TO_OPS: Emergency resolved] [POST_TO_CEO: Emergency resolved same-day, no customer impact] [UPDATE_STATE: {"action": "complete_job", "techId": "marcus", "jobId": "emergency-1"}]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('All handled.');
    expect(result.opsMessages).toHaveLength(1);
    expect(result.ceoMessages).toHaveLength(1);
    expect(result.stateUpdates).toHaveLength(1);
    expect(result.ceoMessages[0]).toBe(
      'Emergency resolved same-day, no customer impact',
    );
  });

  it('handles CREATE_REMINDER alongside POST_TO_CUSTOMER', () => {
    const input =
      'Done! [POST_TO_CUSTOMER: Your water heater is all set!] [CREATE_REMINDER: {"createdBy": {"role": "system", "id": "system"}, "targetChannel": "customer", "targetId": "garcia", "triggerAt": "2027-03-16T09:00:00Z", "message": "Annual flush reminder", "context": "Post-install reminder"}]';
    const result = parseDirectives(input);

    expect(result.customerMessages).toHaveLength(1);
    expect(result.reminderDirectives).toHaveLength(1);
    expect(result.reminderDirectives[0].triggerAt).toBe('2027-03-16T09:00:00Z');
  });

  it('returns empty arrays when no CEO or reminder directives present', () => {
    const input = 'Normal response. [POST_TO_OPS: ops update]';
    const result = parseDirectives(input);

    expect(result.ceoMessages).toEqual([]);
    expect(result.reminderDirectives).toEqual([]);
  });
});
