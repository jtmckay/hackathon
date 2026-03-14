import type { Customer, ServiceEvent } from "../types.js";
import type { Channel } from "./conversation.js";
import {
  getCustomers,
  getCustomerById,
  getCustomerByAddress,
  getCustomerByName,
  getTechs,
  getSchedule,
  addCustomer,
} from "../state/state.js";

export interface ResolvedAccount {
  customer: Customer;
  isNew: boolean;
}

/**
 * Resolves an inbound message to a customer account.
 *
 * Matching strategy (in priority order):
 * 1. Explicit customer ID (from Telegram mapping or metadata)
 * 2. Name mention in the message
 * 3. Address mention in the message
 * 4. Active job association (tech channel — resolve from tech's current job)
 * 5. Create a provisional new account if no match found
 */
export function resolveAccount(
  message: string,
  channel: Channel,
  metadata?: { customerId?: string; senderContext?: string }
): ResolvedAccount {
  // 1. Direct customer ID mapping
  if (metadata?.customerId) {
    const customer = getCustomerById(metadata.customerId);
    if (customer) {
      return { customer, isNew: false };
    }
  }

  // 2. Try to resolve from sender context (e.g., "[this message is from tech Marcus]")
  if (channel === "ops" && metadata?.senderContext) {
    const resolved = resolveFromTechContext(metadata.senderContext);
    if (resolved) {
      return { customer: resolved, isNew: false };
    }
  }

  const customers = getCustomers();

  // 3. Name mention matching
  const nameMatch = matchByName(message, customers);
  if (nameMatch) {
    return { customer: nameMatch, isNew: false };
  }

  // 4. Address mention matching
  const addressMatch = matchByAddress(message, customers);
  if (addressMatch) {
    return { customer: addressMatch, isNew: false };
  }

  // 5. Active job association — check if message references an address with an active job
  const jobMatch = matchByActiveJob(message);
  if (jobMatch) {
    return { customer: jobMatch, isNew: false };
  }

  // 6. No match — create a provisional new account
  return {
    customer: createProvisionalAccount(message),
    isNew: true,
  };
}

function matchByName(message: string, customers: Customer[]): Customer | null {
  const msgLower = message.toLowerCase();

  for (const customer of customers) {
    const lastName = customer.name.toLowerCase();
    // Match patterns like "Mrs. Garcia", "Mr. Chen", "this is Garcia", "I'm Garcia"
    // Also match bare last name if it's distinctive enough (3+ chars)
    if (lastName.length >= 3) {
      // Check for common prefixes + name
      const patterns = [
        `mrs. ${lastName}`,
        `mrs ${lastName}`,
        `mr. ${lastName}`,
        `mr ${lastName}`,
        `ms. ${lastName}`,
        `ms ${lastName}`,
        `this is ${lastName}`,
        `i'm ${lastName}`,
        `i am ${lastName}`,
        `name is ${lastName}`,
        `it's ${lastName}`,
      ];
      for (const pattern of patterns) {
        if (msgLower.includes(pattern)) {
          return customer;
        }
      }
      // Also match standalone last name bounded by word boundaries
      const nameRegex = new RegExp(`\\b${escapeRegex(lastName)}\\b`, "i");
      if (nameRegex.test(message)) {
        return customer;
      }
    }
  }
  return null;
}

function matchByAddress(
  message: string,
  customers: Customer[]
): Customer | null {
  const msgLower = message.toLowerCase();

  for (const customer of customers) {
    if (!customer.address) continue;
    // Extract the street portion (first part before the city)
    const streetPart = customer.address.split(",")[0].toLowerCase().trim();
    if (streetPart.length >= 5 && msgLower.includes(streetPart)) {
      return customer;
    }
  }
  return null;
}

function resolveFromTechContext(senderContext: string): Customer | null {
  // If a tech is sending the message, resolve the customer from the tech's current job
  const techs = getTechs();
  const schedule = getSchedule();

  const ctxLower = senderContext.toLowerCase();
  for (const tech of techs) {
    if (
      ctxLower.includes(tech.name.toLowerCase()) ||
      ctxLower.includes(tech.id)
    ) {
      if (tech.currentJobId) {
        const job = schedule.jobs.find((j) => j.id === tech.currentJobId);
        if (job) {
          return getCustomerById(job.customerId) ?? null;
        }
      }
    }
  }
  return null;
}

function matchByActiveJob(message: string): Customer | null {
  const schedule = getSchedule();
  const msgLower = message.toLowerCase();

  for (const job of schedule.jobs) {
    if (job.status !== "scheduled" && job.status !== "in_progress") continue;
    const streetPart = job.address.split(",")[0].toLowerCase().trim();
    if (streetPart.length >= 5 && msgLower.includes(streetPart)) {
      return getCustomerById(job.customerId) ?? null;
    }
  }
  return null;
}

function createProvisionalAccount(message: string): Customer {
  const id = `new-${Date.now()}`;
  const now = new Date().toISOString();

  const customer: Customer = {
    id,
    name: "Unknown",
    address: "",
    phone: "",
    customerSince: null,
    tier: 3,
    lifetimeValue: 0,
    jobCount: 0,
    referralCount: 0,
    notes: `Provisional account. First contact: ${now}`,
    complaintHistory: [],
    lastJobDate: null,
    lastJobType: null,
    communicationPreference: "text",
    paymentHistory: "good",
    serviceHistory: [
      {
        id: `${id}-ev-1`,
        timestamp: now,
        type: "intake",
        channel: "customer",
        summary: `First contact — new caller.`,
        details: `Initial message: "${message.slice(0, 200)}"`,
        sentiment: "neutral",
      },
    ],
  };

  addCustomer(customer);
  return customer;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
