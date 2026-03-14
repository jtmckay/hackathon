import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({
  getServiceHistory: vi.fn((customerId: string) => {
    if (customerId === 'garcia') {
      return [
        {
          id: 'evt-garcia-001',
          timestamp: '2021-03-15T10:00:00Z',
          type: 'intake',
          channel: 'customer',
          summary: 'First call — kitchen faucet replacement. Neighbor referred her to Shamrock.',
          details: 'Straightforward faucet swap. House has original copper plumbing — two-story, built in the 80s.',
          techId: 'marcus',
          jobType: 'Faucet repair',
          sentiment: 'positive',
        },
        {
          id: 'evt-garcia-004',
          timestamp: '2022-04-03T06:30:00Z',
          type: 'intake',
          channel: 'customer',
          summary: 'Emergency — basement flooding from burst pipe. Mrs. Garcia was very shaken up.',
          jobType: 'Emergency repair',
          sentiment: 'distressed',
        },
        {
          id: 'evt-garcia-005',
          timestamp: '2022-04-03T06:50:00Z',
          type: 'dispatch',
          channel: 'ops',
          summary: 'Marcus dispatched to Garcia emergency. Arrived in 20 minutes.',
          techId: 'marcus',
          jobType: 'Emergency repair',
        },
        {
          id: 'evt-garcia-007',
          timestamp: '2023-02-15T08:00:00Z',
          type: 'completion',
          channel: 'tech',
          summary: 'Bathroom remodel plumbing completed. 3-day job by Marcus.',
          techId: 'marcus',
          jobType: 'Bathroom remodel',
          sentiment: 'positive',
        },
        {
          id: 'evt-garcia-008',
          timestamp: '2023-02-20T10:00:00Z',
          type: 'referral',
          channel: 'system',
          summary: 'Mrs. Garcia referred the Chen family.',
        },
        {
          id: 'evt-garcia-009',
          timestamp: '2026-02-20T08:00:00Z',
          type: 'completion',
          channel: 'tech',
          summary: 'Tankless water heater install by Marcus.',
          techId: 'marcus',
          jobType: 'Water heater install',
          sentiment: 'positive',
        },
      ];
    }
    return [];
  }),
  getTechs: vi.fn(() => [
    { id: 'marcus', name: 'Marcus' },
    { id: 'tyler', name: 'Tyler' },
  ]),
}));

import { buildRelationshipSummary } from '../relationship-summary.js';
import type { Customer } from '../state.js';

describe('Relationship Summary Builder', () => {
  it('builds a rich summary for a known Tier 1 customer (Garcia)', () => {
    const garcia: Customer = {
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
      notes: 'VIP. Blake considers her the gold standard customer. Has a large dog (friendly). Prefers morning appointments. Requests Marcus specifically when available.',
      complaintHistory: [],
      communicationPreference: 'text',
      paymentHistory: 'excellent',
      serviceHistory: [],
    };

    const summary = buildRelationshipSummary(garcia);

    expect(summary).toContain('CUSTOMER CONTEXT — Garcia');
    expect(summary).toContain('VIP customer');
    expect(summary).toContain('12 jobs completed');
    expect(summary).toContain('referred 3 other customers');
    expect(summary).toContain('Always pays on time');
    expect(summary).toContain('Water heater install by Marcus');
    expect(summary).toContain('1847 Canyon Rd, Lehi');
    expect(summary).toContain('copper');
    expect(summary).toContain('morning');
    expect(summary).toContain('dog');
    expect(summary).toContain('Marcus');
    // Should include key history highlights
    expect(summary).toContain('Emergency');
    expect(summary).toContain('referred');
  });

  it('builds a new customer summary for unknown/prospective customer', () => {
    const webber: Customer = {
      id: 'webber',
      name: 'Webber',
      address: '742 Lakeside Dr, Saratoga Springs',
      phone: '801-555-0890',
      tier: 3,
      customerSince: null,
      jobCount: 0,
      referralCount: 0,
      lifetimeValue: 0,
      lastJobDate: null,
      lastJobType: null,
      notes: 'Prospective customer.',
      complaintHistory: [],
      communicationPreference: 'call',
      paymentHistory: null,
    };

    const summary = buildRelationshipSummary(webber);

    expect(summary).toContain('CUSTOMER CONTEXT — Webber');
    expect(summary).toContain('New. No prior history with Shamrock');
    expect(summary).toContain('first impression');
    expect(summary).toContain("Don't interrogate");
  });

  it('includes complaint history for customers with complaints', () => {
    const nelson: Customer = {
      id: 'nelson',
      name: 'Nelson',
      address: '884 Pine Ridge Rd, Eagle Mountain',
      phone: '801-555-0901',
      tier: 2,
      customerSince: '2024-01-10',
      jobCount: 3,
      referralCount: 0,
      lifetimeValue: 1100,
      lastJobDate: '2025-02-20',
      lastJobType: 'Faucet repair',
      notes: 'Complaint pattern customer.',
      complaintHistory: [
        {
          date: '2024-06-15',
          jobType: 'Drain clearing',
          complaint: 'Drain still slow',
          resolution: 'Free callback — no blockage found',
          costToShamrock: 150,
        },
      ],
      communicationPreference: 'call',
      paymentHistory: 'slow',
    };

    const summary = buildRelationshipSummary(nelson);

    expect(summary).toContain('1 prior complaint');
    expect(summary).toContain('Drain still slow');
    expect(summary).toContain('Slow payer');
  });
});
