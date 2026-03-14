import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendServiceEvent,
  getServiceHistory,
  getRecentHistory,
  getCustomerById,
  resetToDefault,
} from '../state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const STATE_DIR = join(ROOT, 'state');

describe('Service Event Ledger', () => {
  beforeEach(() => {
    // Reset state to data defaults before each test
    resetToDefault();
  });

  it('appends a service event to an existing customer', () => {
    appendServiceEvent('garcia', {
      id: 'evt-test-001',
      timestamp: '2026-03-16T10:00:00Z',
      type: 'communication',
      channel: 'customer',
      summary: 'Mrs. Garcia called about a noise in her water heater.',
      sentiment: 'neutral',
    });

    const history = getServiceHistory('garcia');
    const lastEvent = history[history.length - 1];
    expect(lastEvent.id).toBe('evt-test-001');
    expect(lastEvent.type).toBe('communication');
    expect(lastEvent.summary).toContain('noise in her water heater');
  });

  it('returns empty array for customer with no service history', () => {
    const history = getServiceHistory('webber');
    expect(history).toEqual([]);
  });

  it('returns service history sorted chronologically', () => {
    const history = getServiceHistory('garcia');
    for (let i = 1; i < history.length; i++) {
      expect(new Date(history[i].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(history[i - 1].timestamp).getTime(),
      );
    }
  });

  it('getRecentHistory returns last N events', () => {
    const recent = getRecentHistory('garcia', 2);
    expect(recent).toHaveLength(2);
    // Should be the last 2 events chronologically
    const full = getServiceHistory('garcia');
    expect(recent[0].id).toBe(full[full.length - 2].id);
    expect(recent[1].id).toBe(full[full.length - 1].id);
  });

  it('getCustomerById returns the correct customer', () => {
    const garcia = getCustomerById('garcia');
    expect(garcia).toBeDefined();
    expect(garcia!.name).toBe('Garcia');
    expect(garcia!.tier).toBe(1);
  });

  it('getCustomerById returns undefined for nonexistent customer', () => {
    const result = getCustomerById('nonexistent');
    expect(result).toBeUndefined();
  });

  it('events are append-only — previous events are preserved', () => {
    const beforeCount = getServiceHistory('garcia').length;

    appendServiceEvent('garcia', {
      id: 'evt-test-append',
      timestamp: '2026-03-16T12:00:00Z',
      type: 'note',
      channel: 'system',
      summary: 'Test note.',
    });

    const afterCount = getServiceHistory('garcia').length;
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('does not modify events of other customers when appending', () => {
    const chenBefore = getServiceHistory('chen').length;

    appendServiceEvent('garcia', {
      id: 'evt-test-isolation',
      timestamp: '2026-03-16T12:00:00Z',
      type: 'note',
      channel: 'system',
      summary: 'Isolation test.',
    });

    const chenAfter = getServiceHistory('chen').length;
    expect(chenAfter).toBe(chenBefore);
  });
});
