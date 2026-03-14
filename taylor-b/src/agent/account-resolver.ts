import {
  getCustomers,
  getSchedule,
  getTechs,
  addCustomer,
  type Customer,
} from './state.js';

export interface ResolvedAccount {
  customer: Customer;
  isNew: boolean;
  matchMethod: string;
}

/**
 * Resolve an inbound message to a customer account.
 *
 * Matching priority:
 * 1. Telegram sender name → customer name match
 * 2. Name mention in message text ("This is Mrs. Garcia")
 * 3. Address mention in message text
 * 4. Active job association (tech channel context)
 * 5. Create provisional new account
 */
export function resolveAccount(
  senderName: string,
  messageText: string,
  channel: 'customer' | 'ops',
): ResolvedAccount {
  const customers = getCustomers();

  // 1. Direct sender name match
  const byName = matchByName(senderName, customers);
  if (byName) {
    return { customer: byName, isNew: false, matchMethod: 'sender_name' };
  }

  // 2. Name mention in message
  const byMention = matchByNameMention(messageText, customers);
  if (byMention) {
    return { customer: byMention, isNew: false, matchMethod: 'name_mention' };
  }

  // 3. Address mention in message
  const byAddress = matchByAddress(messageText, customers);
  if (byAddress) {
    return { customer: byAddress, isNew: false, matchMethod: 'address_match' };
  }

  // 4. Tech channel context — if a tech is talking, resolve from their current job
  if (channel === 'ops') {
    const byTechContext = matchByTechContext(senderName);
    if (byTechContext) {
      return { customer: byTechContext, isNew: false, matchMethod: 'tech_job_context' };
    }
  }

  // 5. Create provisional new account
  const newCustomer = createProvisionalAccount(senderName, messageText);
  return { customer: newCustomer, isNew: true, matchMethod: 'new_account' };
}

function matchByName(
  senderName: string,
  customers: Customer[],
): Customer | null {
  const lower = senderName.toLowerCase();
  return (
    customers.find((c) => {
      const nameParts = c.name.toLowerCase().split(' ');
      return (
        c.name.toLowerCase() === lower ||
        nameParts.some((part) => part === lower)
      );
    }) ?? null
  );
}

function matchByNameMention(
  text: string,
  customers: Customer[],
): Customer | null {
  const lower = text.toLowerCase();

  // Check for patterns like "This is Mrs. Garcia", "I'm Garcia", "my name is Garcia"
  for (const customer of customers) {
    const name = customer.name.toLowerCase();
    const patterns = [
      `this is ${name}`,
      `this is mrs. ${name}`,
      `this is mr. ${name}`,
      `this is ms. ${name}`,
      `i'm ${name}`,
      `i am ${name}`,
      `my name is ${name}`,
      `name is ${name}`,
      `mrs. ${name}`,
      `mr. ${name}`,
    ];
    if (patterns.some((p) => lower.includes(p))) {
      return customer;
    }
  }
  return null;
}

function matchByAddress(
  text: string,
  customers: Customer[],
): Customer | null {
  const lower = text.toLowerCase();
  for (const customer of customers) {
    if (!customer.address) continue;
    // Match on the street portion (first part before the comma)
    const streetPart = customer.address.split(',')[0].toLowerCase().trim();
    if (streetPart.length > 5 && lower.includes(streetPart)) {
      return customer;
    }
  }
  return null;
}

function matchByTechContext(senderName: string): Customer | null {
  const techs = getTechs();
  const matchedTech = techs.find(
    (t) => t.name.toLowerCase() === senderName.toLowerCase(),
  );
  if (!matchedTech?.currentJobId) return null;

  const schedule = getSchedule();
  const currentJob = schedule.jobs.find(
    (j) => String(j.id) === String(matchedTech.currentJobId),
  );
  if (!currentJob) return null;

  const customers = getCustomers();
  return customers.find((c) => c.id === currentJob.customerId) ?? null;
}

function createProvisionalAccount(
  senderName: string,
  messageText: string,
): Customer {
  const id = `new-${senderName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  const now = new Date().toISOString();

  const customer: Customer = {
    id,
    name: senderName,
    address: '',
    phone: '',
    tier: 3,
    customerSince: null,
    jobCount: 0,
    referralCount: 0,
    lifetimeValue: 0,
    lastJobDate: null,
    lastJobType: null,
    notes: `First contact: ${now.substring(0, 10)}. "${messageText.substring(0, 100)}"`,
    complaintHistory: [],
    communicationPreference: 'text',
    paymentHistory: null,
    serviceHistory: [
      {
        id: `evt-${id}-001`,
        timestamp: now,
        type: 'intake',
        channel: 'customer',
        summary: `First contact from ${senderName}.`,
        details: messageText.substring(0, 500),
        sentiment: 'neutral',
      },
    ],
  };

  addCustomer(customer);
  return customer;
}
