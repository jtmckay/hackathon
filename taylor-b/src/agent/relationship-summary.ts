import type { Customer, ServiceEvent } from './state.js';
import { getServiceHistory, getTechs } from './state.js';

/**
 * Build a natural-language relationship summary for prompt injection.
 * Reads like a trusted employee's mental notes — not a database dump.
 */
export function buildRelationshipSummary(customer: Customer): string {
  if (!customer.customerSince || customer.jobCount === 0) {
    return buildNewCustomerSummary(customer);
  }
  return buildKnownCustomerSummary(customer);
}

function buildNewCustomerSummary(customer: Customer): string {
  const name = customer.name || 'Unknown Caller';
  const lines: string[] = [];
  lines.push(`CUSTOMER CONTEXT — ${name}`);
  lines.push('━'.repeat(35));
  lines.push('Relationship: New. No prior history with Shamrock.');
  lines.push('              This is our first impression — make it count.');
  lines.push('Notes:        Collect name, address, and contact info naturally during conversation.');
  lines.push("              Don't interrogate. Let them tell us what's wrong first.");
  if (customer.address) {
    lines.push(`Address:      ${customer.address} (provided so far)`);
  }
  if (customer.phone) {
    lines.push(`Phone:        ${customer.phone}`);
  }
  return lines.join('\n');
}

function buildKnownCustomerSummary(customer: Customer): string {
  const lines: string[] = [];
  const techs = getTechs();
  const history = getServiceHistory(customer.id);

  lines.push(`CUSTOMER CONTEXT — ${customer.name}`);
  lines.push('━'.repeat(35));

  // Relationship line
  const years = customerYears(customer.customerSince!);
  const tierLabel = customer.tier === 1 ? 'VIP customer' : 'Regular customer';
  let relLine = `Relationship: ${tierLabel} since ${formatDate(customer.customerSince!)} (${years}).`;
  relLine += ` ${customer.jobCount} jobs completed.`;
  lines.push(relLine);

  if (customer.referralCount > 0) {
    lines.push(`              Has referred ${customer.referralCount} other customer${customer.referralCount > 1 ? 's' : ''} to us.`);
  }
  if (customer.paymentHistory) {
    const payLabel = customer.paymentHistory === 'excellent'
      ? 'Always pays on time.'
      : customer.paymentHistory === 'good'
        ? 'Pays reliably.'
        : customer.paymentHistory === 'slow'
          ? 'Slow payer — follow up on invoices.'
          : '';
    if (payLabel) {
      lines.push(`              ${payLabel}`);
    }
  }

  // Last contact
  if (customer.lastJobDate && customer.lastJobType) {
    const lastEvent = history.length > 0 ? history[history.length - 1] : null;
    const techName = lastEvent?.techId
      ? techs.find((t) => t.id === lastEvent.techId)?.name || lastEvent.techId
      : null;
    let lastLine = `Last contact: ${customer.lastJobType}`;
    if (techName) lastLine += ` by ${techName}`;
    lastLine += `, ${formatDate(customer.lastJobDate)}.`;
    lines.push(lastLine);
  }

  // Property info
  lines.push(`Property:     ${customer.address}`);
  const propertyNotes = extractPropertyNotes(history);
  if (propertyNotes) {
    lines.push(`              ${propertyNotes}`);
  }

  // Preferences
  const prefs = extractPreferences(customer, history);
  if (prefs.length > 0) {
    lines.push(`Preferences:  ${prefs[0]}`);
    for (let i = 1; i < prefs.length; i++) {
      lines.push(`              ${prefs[i]}`);
    }
  }

  // Preferred tech
  const preferredTech = findPreferredTech(history, techs);
  if (preferredTech) {
    lines.push(`              Likes ${preferredTech} — requests them specifically when available.`);
  }

  // Complaint history
  if (customer.complaintHistory.length > 0) {
    lines.push(`Complaints:   ${customer.complaintHistory.length} prior complaint${customer.complaintHistory.length > 1 ? 's' : ''}.`);
    for (const c of customer.complaintHistory) {
      lines.push(`              ${c.date}: ${c.complaint} → ${c.resolution}`);
    }
  }

  // Notes / special handling
  if (customer.notes) {
    lines.push(`Notes:        ${customer.notes}`);
  }

  // Key service history highlights
  const highlights = extractHighlights(history);
  if (highlights.length > 0) {
    lines.push('');
    lines.push('Key history:');
    for (const h of highlights) {
      lines.push(`  - ${h}`);
    }
  }

  return lines.join('\n');
}

function customerYears(since: string): string {
  const start = new Date(since);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(
    (diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000),
  );
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years}+ year${years !== 1 ? 's' : ''}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function extractPropertyNotes(history: ServiceEvent[]): string {
  const notes: string[] = [];
  for (const evt of history) {
    const details = evt.details || '';
    if (details.toLowerCase().includes('copper plumbing')) {
      notes.push('Older plumbing (copper).');
    }
    if (details.toLowerCase().includes('pex')) {
      notes.push('PEX plumbing (re-piped).');
    }
    if (details.toLowerCase().includes('two-story')) {
      notes.push('Two-story home.');
    }
    if (details.toLowerCase().includes('corrosion')) {
      notes.push('Some corrosion noted — monitor.');
    }
    if (details.toLowerCase().includes('root intrusion') || details.toLowerCase().includes('tree root')) {
      notes.push('Root intrusion risk in sewer line.');
    }
  }
  // Deduplicate
  return [...new Set(notes)].join(' ');
}

function extractPreferences(customer: Customer, _history: ServiceEvent[]): string[] {
  const prefs: string[] = [];
  const notes = customer.notes.toLowerCase();
  if (notes.includes('morning') || customer.communicationPreference === 'text' && notes.includes('morning')) {
    prefs.push('Prefers morning appointments.');
  }
  if (notes.includes('afternoon')) {
    prefs.push('Prefers afternoon appointments.');
  }
  if (notes.includes('dog')) {
    prefs.push('Has a large dog (friendly).');
  }
  if (notes.includes('flexible')) {
    prefs.push('Very flexible on scheduling.');
  }
  if (notes.includes('works from home')) {
    prefs.push('Works from home — morning appointments preferred.');
  }
  if (customer.communicationPreference) {
    prefs.push(`Prefers ${customer.communicationPreference} for communication.`);
  }
  return prefs;
}

function findPreferredTech(
  history: ServiceEvent[],
  techs: { id: string; name: string }[],
): string | null {
  const techCounts = new Map<string, number>();
  for (const evt of history) {
    if (evt.techId && (evt.type === 'completion' || evt.type === 'dispatch')) {
      techCounts.set(evt.techId, (techCounts.get(evt.techId) || 0) + 1);
    }
  }
  if (techCounts.size === 0) return null;

  let maxId = '';
  let maxCount = 0;
  for (const [id, count] of techCounts) {
    if (count > maxCount) {
      maxId = id;
      maxCount = count;
    }
  }
  // Only flag a preferred tech if they've done 2+ jobs
  if (maxCount < 2) return null;
  return techs.find((t) => t.id === maxId)?.name || maxId;
}

function extractHighlights(history: ServiceEvent[]): string[] {
  const highlights: string[] = [];
  for (const evt of history) {
    // Emergencies are always notable
    if (evt.type === 'intake' && evt.sentiment === 'distressed') {
      const date = evt.timestamp.substring(0, 10);
      highlights.push(`${date}: ${evt.summary}`);
    }
    // Referrals
    if (evt.type === 'referral') {
      const date = evt.timestamp.substring(0, 10);
      highlights.push(`${date}: ${evt.summary}`);
    }
    // Complaints
    if (evt.type === 'complaint') {
      const date = evt.timestamp.substring(0, 10);
      highlights.push(`${date}: ${evt.summary}`);
    }
  }
  return highlights.slice(-5); // Keep at most 5 highlights
}
