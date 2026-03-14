import type { Customer, ServiceEvent } from "../types.js";
import { getTechById } from "../state/state.js";

/**
 * Generates a concise, natural-language relationship summary for prompt injection.
 * This is what the agent "remembers" about the customer when they reach out.
 *
 * For known customers: reads like a trusted employee's mental notes.
 * For new/unknown customers: instructs the agent to treat this as an audition.
 */
export function buildRelationshipSummary(customer: Customer): string {
  if (isNewOrUnknown(customer)) {
    return buildNewCustomerSummary(customer);
  }
  return buildKnownCustomerSummary(customer);
}

function isNewOrUnknown(customer: Customer): boolean {
  return (
    !customer.customerSince ||
    customer.jobCount === 0 ||
    customer.name === "Unknown"
  );
}

function buildNewCustomerSummary(customer: Customer): string {
  const name = customer.name === "Unknown" ? "Unknown Caller" : customer.name;
  const lines: string[] = [];
  lines.push(`CUSTOMER CONTEXT — ${name}`);
  lines.push("━".repeat(35));
  lines.push("Relationship: New. No prior history with Shamrock.");
  lines.push("              This is our first impression — make it count.");
  lines.push("");
  lines.push("Notes:        Collect name, address, and contact info naturally during conversation.");
  lines.push("              Don't interrogate. Let them tell us what's wrong first.");
  if (customer.address) {
    lines.push(`              Address on file: ${customer.address}`);
  }
  return lines.join("\n");
}

function buildKnownCustomerSummary(customer: Customer): string {
  const lines: string[] = [];
  const displayName = getDisplayName(customer);

  lines.push(`CUSTOMER CONTEXT — ${displayName}`);
  lines.push("━".repeat(35));

  // Relationship line
  const relationshipLength = getRelationshipLength(customer.customerSince!);
  const tierLabel = customer.tier === 1 ? "VIP" : customer.tier === 2 ? "Regular" : "New";
  let relLine = `Relationship: ${tierLabel} customer since ${formatDate(customer.customerSince!)} (${relationshipLength}). ${customer.jobCount} jobs completed.`;
  lines.push(relLine);

  // Referrals and payment
  const extras: string[] = [];
  if (customer.referralCount > 0) {
    extras.push(`Has referred ${customer.referralCount} other customer${customer.referralCount > 1 ? "s" : ""} to us`);
  }
  if (customer.paymentHistory === "excellent") {
    extras.push("Always pays on time");
  } else if (customer.paymentHistory === "slow") {
    extras.push("Payment history: slow");
  }
  if (extras.length > 0) {
    lines.push(`             ${extras.join(". ")}.`);
  }

  // Last contact
  const history = customer.serviceHistory ?? [];
  const lastCompletion = [...history]
    .reverse()
    .find((e) => e.type === "completion");
  if (lastCompletion) {
    const techName = lastCompletion.techId
      ? getTechById(lastCompletion.techId)?.name ?? lastCompletion.techId
      : "unknown tech";
    lines.push(
      `Last contact: ${lastCompletion.jobType ?? "Service"} by ${techName}, ${formatDate(lastCompletion.timestamp)}.`
    );
  } else if (customer.lastJobDate && customer.lastJobType) {
    lines.push(
      `Last contact: ${customer.lastJobType}, ${formatDate(customer.lastJobDate)}.`
    );
  }

  // Property
  lines.push(`Property:     ${customer.address}`);

  // Extract property notes from service history
  const propertyNotes = extractPropertyNotes(history);
  if (propertyNotes) {
    lines.push(`              ${propertyNotes}`);
  }

  // Preferences
  const preferences = extractPreferences(customer, history);
  if (preferences.length > 0) {
    lines.push(`Preferences:  ${preferences.join(". ")}.`);
  }

  // Notes — customer notes plus any important details
  const notes = buildNotesSection(customer, history);
  if (notes.length > 0) {
    lines.push(`Notes:        ${notes[0]}`);
    for (let i = 1; i < notes.length; i++) {
      lines.push(`              ${notes[i]}`);
    }
  }

  // Complaint history warning if relevant
  if (customer.complaintHistory.length > 0) {
    lines.push("");
    lines.push(`⚠️ Complaint history: ${customer.complaintHistory.length} prior complaint(s).`);
    for (const complaint of customer.complaintHistory) {
      lines.push(`  - ${complaint.date}: ${complaint.issue} → ${complaint.resolution}`);
    }
  }

  return lines.join("\n");
}

function getDisplayName(customer: Customer): string {
  const name = customer.name;
  // For Tier 1 customers, use honorific
  if (customer.tier === 1) {
    return `Mrs./Mr. ${name}`;
  }
  return name;
}

function getRelationshipLength(since: string): string {
  const start = new Date(since);
  const now = new Date();
  const years = now.getFullYear() - start.getFullYear();
  const months = now.getMonth() - start.getMonth();
  const totalMonths = years * 12 + months;

  if (totalMonths < 12) {
    return `${totalMonths} month${totalMonths !== 1 ? "s" : ""}`;
  }
  const yrs = Math.floor(totalMonths / 12);
  return `${yrs} year${yrs !== 1 ? "s" : ""}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function extractPropertyNotes(history: ServiceEvent[]): string | null {
  const notes: string[] = [];
  for (const event of history) {
    if (!event.details) continue;
    const detail = event.details.toLowerCase();
    if (detail.includes("copper plumbing") || detail.includes("copper pipe")) {
      notes.push("Older copper plumbing");
    }
    if (detail.includes("galvanized")) {
      notes.push("Has galvanized pipes");
    }
    if (detail.includes("re-pipe")) {
      notes.push("Partial re-pipe done");
    }
  }
  if (notes.length === 0) return null;
  // Deduplicate
  return [...new Set(notes)].join(". ") + ".";
}

function extractPreferences(
  customer: Customer,
  history: ServiceEvent[]
): string[] {
  const prefs: string[] = [];

  if (customer.communicationPreference === "text") {
    prefs.push("Prefers text communication");
  } else {
    prefs.push("Prefers phone calls");
  }

  // Check if customer has requested a specific tech
  const techRequests = new Map<string, number>();
  for (const event of history) {
    if (
      event.details?.toLowerCase().includes("requested") &&
      event.techId
    ) {
      techRequests.set(
        event.techId,
        (techRequests.get(event.techId) ?? 0) + 1
      );
    }
  }
  // Also check if most jobs are from the same tech
  const techCounts = new Map<string, number>();
  for (const event of history) {
    if (event.type === "completion" && event.techId) {
      techCounts.set(
        event.techId,
        (techCounts.get(event.techId) ?? 0) + 1
      );
    }
  }
  // Find preferred tech
  let preferredTech: string | null = null;
  for (const [techId, count] of techRequests) {
    if (count >= 1) {
      preferredTech = techId;
    }
  }
  if (!preferredTech) {
    for (const [techId, count] of techCounts) {
      if (count >= 3) {
        preferredTech = techId;
      }
    }
  }
  if (preferredTech) {
    const techName = getTechById(preferredTech)?.name ?? preferredTech;
    prefs.push(`Likes ${techName} — requests him specifically when available`);
  }

  // Check notes for morning/afternoon preferences
  const notesLower = customer.notes.toLowerCase();
  if (notesLower.includes("morning")) {
    prefs.push("Prefers morning appointments");
  }
  if (notesLower.includes("afternoon")) {
    prefs.push("Prefers afternoon appointments");
  }
  if (notesLower.includes("flexible")) {
    prefs.push("Flexible with scheduling");
  }
  if (notesLower.includes("cancellation slot")) {
    prefs.push("Happy to take cancellation slots");
  }

  return prefs;
}

function buildNotesSection(
  customer: Customer,
  history: ServiceEvent[]
): string[] {
  const notes: string[] = [];

  // Tier-based framing
  if (customer.tier === 1) {
    if (customer.referralCount >= 3) {
      notes.push("One of our best customers. Blake has said to treat her like family.");
    } else if (customer.referralCount >= 1) {
      notes.push("Loyal long-time customer. Has referred others to us.");
    } else {
      notes.push("Long-time loyal customer. Treat with extra care.");
    }
    notes.push("If something goes wrong at their house, we drop everything.");
  }

  // Extract meaningful anecdotes from history
  for (const event of history) {
    if (!event.details) continue;
    if (event.details.toLowerCase().includes("cookie") || event.details.toLowerCase().includes("baked")) {
      notes.push("Has baked cookies for the crew — very welcoming household.");
      break;
    }
  }

  // Dog or pet mentions
  for (const event of history) {
    if (!event.details) continue;
    if (event.details.toLowerCase().includes("dog")) {
      const dogMatch = event.details.match(/dog\s+(\w+)/i);
      if (dogMatch) {
        notes.push(`Has a dog (${dogMatch[1]}).`);
      } else {
        notes.push("Has a dog.");
      }
      break;
    }
  }

  // Check notes field for additional info
  if (customer.notes.includes("dog")) {
    const existing = notes.find((n) => n.includes("dog"));
    if (!existing) {
      notes.push("Has a dog.");
    }
  }

  // Complaint pattern warning
  if (customer.complaintHistory.length >= 2) {
    const freeCallbacks = customer.complaintHistory.filter(
      (c) => c.resolution.toLowerCase().includes("no issue") || c.resolution.toLowerCase().includes("no leak")
    );
    if (freeCallbacks.length >= 2) {
      notes.push("⚠️ Pattern flag: Multiple prior complaints resolved with free service where no issue was found. Handle with care.");
    }
  }

  return notes;
}
