import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  getCustomers: vi.fn(() => [
    {
      id: 'garcia',
      name: 'Garcia',
      address: '1847 Canyon Rd, Lehi',
      phone: '801-555-0112',
      tier: 1,
      customerSince: '2021-03-15',
      jobCount: 12,
      referralCount: 3,
      lifetimeValue: 14200,
      lastJobDate: '2026-02-20',
      lastJobType: 'Water heater install',
      notes: 'VIP.',
      complaintHistory: [],
      communicationPreference: 'text',
      paymentHistory: 'excellent',
      serviceHistory: [],
    },
    {
      id: 'chen',
      name: 'Chen',
      address: '562 Maple Dr, American Fork',
      phone: '801-555-0234',
      tier: 1,
      customerSince: '2020-06-10',
      jobCount: 8,
      referralCount: 1,
      lifetimeValue: 9800,
      lastJobDate: '2026-03-05',
      lastJobType: 'Water heater install',
      notes: '',
      complaintHistory: [],
      communicationPreference: 'call',
      paymentHistory: 'excellent',
      serviceHistory: [],
    },
  ]),
  getTechs: vi.fn(() => [
    {
      id: 'marcus',
      name: 'Marcus',
      seniority: 'senior',
      years: 8,
      status: 'on_job',
      currentJobId: 1,
    },
  ]),
  getSchedule: vi.fn(() => ({
    date: '2026-03-16',
    day: 'Monday',
    jobs: [
      {
        id: 1,
        techId: 'marcus',
        time: '08:00',
        type: 'Water heater install',
        customerId: 'garcia',
        address: '1847 Canyon Rd, Lehi',
        durationHrs: 3,
        bumpable: false,
        notes: '',
        status: 'scheduled',
      },
    ],
    flexSlots: [],
  })),
  addCustomer: vi.fn(),
}));

import { resolveAccount } from '../account-resolver.js';

describe('Account Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves known customer by sender name (exact match)', () => {
    const result = resolveAccount('Garcia', 'My water heater is making noise', 'customer');
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe('garcia');
    expect(result.matchMethod).toBe('sender_name');
  });

  it('resolves known customer by sender name (case insensitive)', () => {
    const result = resolveAccount('garcia', 'help!', 'customer');
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe('garcia');
  });

  it('resolves customer by name mention in message', () => {
    const result = resolveAccount('Unknown', 'This is Mrs. Garcia, I need help', 'customer');
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe('garcia');
    expect(result.matchMethod).toBe('name_mention');
  });

  it('resolves customer by address mention in message', () => {
    const result = resolveAccount('Unknown', "I'm at 1847 Canyon Rd and water is everywhere", 'customer');
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe('garcia');
    expect(result.matchMethod).toBe('address_match');
  });

  it('resolves customer from tech context on ops channel', () => {
    const result = resolveAccount('Marcus', 'The homeowner here says the pipe burst yesterday', 'ops');
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe('garcia');
    expect(result.matchMethod).toBe('tech_job_context');
  });

  it('creates provisional account for unknown customer', () => {
    const result = resolveAccount('NewPerson', 'Hi, my toilet is overflowing', 'customer');
    expect(result.isNew).toBe(true);
    expect(result.customer.tier).toBe(3);
    expect(result.customer.name).toBe('NewPerson');
    expect(result.matchMethod).toBe('new_account');
  });

  it('provisional account has initial service event', () => {
    const result = resolveAccount('NewPerson', 'Hi, my toilet is overflowing', 'customer');
    expect(result.customer.serviceHistory).toHaveLength(1);
    expect(result.customer.serviceHistory![0].type).toBe('intake');
  });

  it('does not match unknown sender to tech context on customer channel', () => {
    // Even if sender name matches a tech, on customer channel it should not use tech context
    const result = resolveAccount('Marcus', 'I need a plumber', 'customer');
    // Marcus is a tech name but also not a customer name — should create new
    expect(result.isNew).toBe(true);
  });
});
