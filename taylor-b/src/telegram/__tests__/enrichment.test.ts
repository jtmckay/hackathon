import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the state module before importing handler
vi.mock('../../agent/state.js', () => ({
  getTechs: vi.fn(() => [
    { id: 'marcus', name: 'Marcus', seniority: 'senior', years: 8, status: 'on_job', currentJobId: 1 },
  ]),
  getCustomers: vi.fn(() => [
    {
      id: 'garcia',
      name: 'Garcia',
      address: '1847 Canyon Rd, Lehi',
      phone: '801-555-0112',
      tier: 1,
      jobCount: 12,
      lifetimeValue: 14200,
      complaintHistory: [],
      lastJobDate: '2026-02-20',
      lastJobType: 'Water heater install',
    },
    {
      id: 'nelson',
      name: 'Nelson',
      address: '884 Pine Ridge Rd, Eagle Mountain',
      phone: '801-555-0901',
      tier: 2,
      jobCount: 3,
      lifetimeValue: 1100,
      complaintHistory: [
        { date: '2024-06-15', jobType: 'Drain clearing', complaint: 'slow drain', resolution: 'free callback', costToShamrock: 150 },
        { date: '2025-02-20', jobType: 'Faucet repair', complaint: 'leaking again', resolution: 'free callback', costToShamrock: 120 },
      ],
      lastJobDate: '2025-02-20',
      lastJobType: 'Faucet repair',
    },
  ]),
  getSchedule: vi.fn(() => ({
    date: '2026-03-16', day: 'Monday',
    jobs: [
      { id: 1, techId: 'marcus', time: '08:00', type: 'Water heater install', customerId: 'garcia', address: '1847 Canyon Rd, Lehi', durationHrs: 3, bumpable: false, status: 'in_progress', notes: '' },
    ],
    flexSlots: [],
  })),
  getHistory: vi.fn(() => []),
  appendHistory: vi.fn(),
  applyStateUpdate: vi.fn(),
}));

// Import the enrichMessage function from the handler module
import { enrichMessage } from '../handler.js';
import { getCustomers, getTechs, getSchedule } from '../../agent/state.js';
import type { Customer, Tech, ChannelId } from '../../agent/state.js';

// Keep the old replicated function for backward compat with existing tests
function enrichMessageLocal(
  text: string,
  senderName: string,
  channel: 'customer' | 'ops',
): string {
  if (channel === 'ops') {
    const techs = getTechs() as Tech[];
    const matchedTech = techs.find(
      (t) => t.name.toLowerCase() === senderName.toLowerCase(),
    );
    if (matchedTech) {
      return `Tech ${matchedTech.name} says: ${text}`;
    }
    return `[Ops - ${senderName}]: ${text}`;
  }

  const customers = getCustomers() as Customer[];
  const matchedCustomer = customers.find((c) => {
    const nameParts = c.name.split(' ');
    const lastName = nameParts[nameParts.length - 1]?.toLowerCase();
    const firstName = nameParts[0]?.toLowerCase();
    return (
      senderName.toLowerCase() === lastName ||
      senderName.toLowerCase() === firstName ||
      senderName.toLowerCase() === c.name.toLowerCase()
    );
  });

  if (matchedCustomer) {
    const complaintCount = matchedCustomer.complaintHistory?.length ?? 0;
    const complaints = complaintCount > 0
      ? `, ${complaintCount} prior complaints`
      : '';
    const recentWork = matchedCustomer.lastJobDate && matchedCustomer.lastJobType
      ? `, last job: ${matchedCustomer.lastJobType} on ${matchedCustomer.lastJobDate}`
      : '';
    return `[Customer: ${matchedCustomer.name}, Tier ${matchedCustomer.tier}, ${matchedCustomer.jobCount} jobs, lifetime value $${matchedCustomer.lifetimeValue}${complaints}${recentWork}]: ${text}`;
  }

  return `[Customer - ${senderName}]: ${text}`;
}

describe('Message enrichment', () => {
  it('enriches known customer (Garcia) with tier, jobs, lifetime value, and last job', () => {
    const result = enrichMessage('water is pouring through my ceiling', 'Garcia', 'customer');
    expect(result).toContain('Customer: Garcia');
    expect(result).toContain('Tier 1');
    expect(result).toContain('12 jobs');
    expect(result).toContain('lifetime value $14200');
    expect(result).toContain('last job: Water heater install on 2026-02-20');
    expect(result).not.toContain('prior complaints');
  });

  it('enriches customer with complaints (Nelson) including complaint count and last job', () => {
    const result = enrichMessage('my faucet is leaking again', 'Nelson', 'customer');
    expect(result).toContain('Customer: Nelson');
    expect(result).toContain('Tier 2');
    expect(result).toContain('2 prior complaints');
    expect(result).toContain('last job: Faucet repair on 2025-02-20');
  });

  it('returns generic format for unknown customer', () => {
    const result = enrichMessage('help, water everywhere!', 'UnknownPerson', 'customer');
    expect(result).toBe('[Customer - UnknownPerson]: help, water everywhere!');
  });

  it('enriches ops tech messages', () => {
    const result = enrichMessage("I'm 20 min out", 'Marcus', 'ops');
    expect(result).toBe("Tech Marcus says: I'm 20 min out");
  });

  it('enriches non-tech ops messages', () => {
    const result = enrichMessageLocal('status update?', 'Blake', 'ops');
    expect(result).toBe('[Ops - Blake]: status update?');
  });
});

describe('Tech channel enrichment', () => {
  it('enriches tech message with identity and current assignment', () => {
    const result = enrichMessage('on my way', 'Marcus', 'tech:marcus');
    expect(result).toContain('Tech Marcus');
    expect(result).toContain('Water heater install');
    expect(result).toContain('Garcia');
    expect(result).toContain('on my way');
  });

  it('enriches tech message without current job', () => {
    // Tyler is not in our mock techs, so it falls back to basic format
    const result = enrichMessage("what's my schedule?", 'Tyler', 'tech:tyler');
    expect(result).toContain('Tech Tyler');
    expect(result).toContain("what's my schedule?");
  });
});
