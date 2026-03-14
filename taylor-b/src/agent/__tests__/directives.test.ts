import { describe, it, expect } from 'vitest';
import { parseDirectives } from '../directives.js';

describe('parseDirectives', () => {
  it('extracts POST_TO_OPS directive and cleans visible text', () => {
    const input =
      "I'll help you right away. [POST_TO_OPS: EMERGENCY INCOMING from customer] Let me ask some questions.";
    const result = parseDirectives(input);

    expect(result.visibleText).toBe(
      "I'll help you right away. Let me ask some questions.",
    );
    expect(result.opsMessages).toEqual(['EMERGENCY INCOMING from customer']);
    expect(result.customerMessages).toEqual([]);
    expect(result.techMessages).toEqual([]);
    expect(result.stateUpdates).toEqual([]);
  });

  it('extracts POST_TO_CUSTOMER directive', () => {
    const input =
      'Dispatching Marcus now. [POST_TO_CUSTOMER: Your tech is on the way! Marcus will be there in about 15 minutes.]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Dispatching Marcus now.');
    expect(result.customerMessages).toEqual([
      'Your tech is on the way! Marcus will be there in about 15 minutes.',
    ]);
  });

  it('extracts UPDATE_STATE directive with flat JSON', () => {
    const input =
      'Done. [UPDATE_STATE: {"action": "update_tech_status", "techId": "marcus", "status": "en_route", "currentJobId": "emergency-1"}]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Done.');
    expect(result.stateUpdates).toEqual([
      {
        action: 'update_tech_status',
        techId: 'marcus',
        status: 'en_route',
        currentJobId: 'emergency-1',
      },
    ]);
  });

  it('extracts UPDATE_STATE with deeply nested JSON (add_emergency_job)', () => {
    const input =
      'Emergency scheduled. [UPDATE_STATE: {"action": "add_emergency_job", "job": {"id": "emergency-1", "techId": "marcus", "time": "10:45", "type": "Active flooding", "customerId": "webber", "address": "742 Lakeside Dr", "status": "in_progress", "bumpable": false}}]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Emergency scheduled.');
    expect(result.stateUpdates).toHaveLength(1);
    expect(result.stateUpdates[0].action).toBe('add_emergency_job');
    expect((result.stateUpdates[0].job as Record<string, unknown>).id).toBe(
      'emergency-1',
    );
  });

  it('extracts multiple directives from a single response', () => {
    const input =
      "I'm sending Marcus right away. [POST_TO_OPS: EMERGENCY: Ceiling leak at 742 Lakeside Dr. Pulling Marcus off Garcia faucet repair.] [UPDATE_STATE: {\"action\": \"update_tech_status\", \"techId\": \"marcus\", \"status\": \"en_route\"}] [UPDATE_STATE: {\"action\": \"update_job_status\", \"jobId\": 3, \"status\": \"paused\"}] We'll have someone there within 20 minutes.";
    const result = parseDirectives(input);

    expect(result.visibleText).toBe(
      "I'm sending Marcus right away. We'll have someone there within 20 minutes.",
    );
    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toBe(
      'EMERGENCY: Ceiling leak at 742 Lakeside Dr. Pulling Marcus off Garcia faucet repair.',
    );
    expect(result.stateUpdates).toHaveLength(2);
    expect(result.stateUpdates[0].action).toBe('update_tech_status');
    expect(result.stateUpdates[1].action).toBe('update_job_status');
  });

  it('returns original text when no directives present', () => {
    const input = 'Just a normal response with no directives.';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Just a normal response with no directives.');
    expect(result.opsMessages).toEqual([]);
    expect(result.customerMessages).toEqual([]);
    expect(result.techMessages).toEqual([]);
    expect(result.stateUpdates).toEqual([]);
  });

  it('handles empty input', () => {
    const result = parseDirectives('');

    expect(result.visibleText).toBe('');
    expect(result.opsMessages).toEqual([]);
    expect(result.customerMessages).toEqual([]);
    expect(result.techMessages).toEqual([]);
    expect(result.stateUpdates).toEqual([]);
  });

  it('handles both ops and customer directives in same response', () => {
    const input =
      "Got it. [POST_TO_OPS: Customer reported emergency at 742 Lakeside] [POST_TO_CUSTOMER: We've received your request and are dispatching help now.] Coordinating now.";
    const result = parseDirectives(input);

    expect(result.opsMessages).toEqual([
      'Customer reported emergency at 742 Lakeside',
    ]);
    expect(result.customerMessages).toEqual([
      "We've received your request and are dispatching help now.",
    ]);
    expect(result.visibleText).toBe('Got it. Coordinating now.');
  });

  it('handles consume_flex_slot state update', () => {
    const input =
      'Flex slot consumed. [UPDATE_STATE: {"action": "consume_flex_slot", "slotId": "flex-am"}]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Flex slot consumed.');
    expect(result.stateUpdates).toEqual([
      { action: 'consume_flex_slot', slotId: 'flex-am' },
    ]);
  });

  it('handles all three directive types in one response', () => {
    const input =
      'Handling this now. [POST_TO_OPS: Emergency dispatch initiated] [POST_TO_CUSTOMER: Help is on the way!] [UPDATE_STATE: {"action": "update_tech_status", "techId": "marcus", "status": "en_route"}] Done coordinating.';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Handling this now. Done coordinating.');
    expect(result.opsMessages).toEqual(['Emergency dispatch initiated']);
    expect(result.customerMessages).toEqual(['Help is on the way!']);
    expect(result.stateUpdates).toHaveLength(1);
    expect(result.stateUpdates[0].action).toBe('update_tech_status');
  });

  // POST_TO_TECH directive tests
  it('extracts POST_TO_TECH(techId) directive', () => {
    const input =
      'Dispatching now. [POST_TO_TECH(marcus): Emergency dispatch — Customer: Garcia, Address: 1847 Canyon Rd. Please confirm.] Awaiting confirmation.';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Dispatching now. Awaiting confirmation.');
    expect(result.techMessages).toHaveLength(1);
    expect(result.techMessages[0].techId).toBe('marcus');
    expect(result.techMessages[0].message).toBe(
      'Emergency dispatch — Customer: Garcia, Address: 1847 Canyon Rd. Please confirm.',
    );
  });

  it('extracts multiple POST_TO_TECH directives for different techs', () => {
    const input =
      'Redistributing jobs. [POST_TO_TECH(tyler): New job assigned — Johnson drain clearing at 1847 W Center St, 2pm.] [POST_TO_TECH(jake): New job assigned — Patterson consultation at 892 S 200 E, 3:30pm.]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Redistributing jobs.');
    expect(result.techMessages).toHaveLength(2);
    expect(result.techMessages[0].techId).toBe('tyler');
    expect(result.techMessages[1].techId).toBe('jake');
  });

  it('handles POST_TO_TECH alongside ops, customer, and state directives', () => {
    const input =
      'Emergency handled. [POST_TO_OPS: Dispatch decision — pulling Marcus] [POST_TO_TECH(marcus): Emergency at 742 Lakeside Dr. Please confirm.] [POST_TO_CUSTOMER: Help is on the way!] [UPDATE_STATE: {"action": "update_tech_status", "techId": "marcus", "status": "dispatched"}]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Emergency handled.');
    expect(result.opsMessages).toHaveLength(1);
    expect(result.techMessages).toHaveLength(1);
    expect(result.techMessages[0].techId).toBe('marcus');
    expect(result.customerMessages).toHaveLength(1);
    expect(result.stateUpdates).toHaveLength(1);
  });

  it('returns empty techMessages when no POST_TO_TECH directives present', () => {
    const input = 'Normal ops response. [POST_TO_OPS: some update]';
    const result = parseDirectives(input);

    expect(result.techMessages).toEqual([]);
  });
});
