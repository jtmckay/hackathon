export interface StateUpdate {
  action: string;
  [key: string]: unknown;
}

export interface TechDirective {
  techId: string;
  message: string;
}

export interface ReminderDirective {
  createdBy: { role: string; id: string };
  targetChannel: string;
  targetId?: string;
  triggerAt: string;
  recurrence?: { interval: string; customDays?: number; endAfter?: string };
  message: string;
  context: string;
  customerId?: string;
  jobId?: string;
}

export interface ParsedResponse {
  visibleText: string;
  opsMessages: string[];
  customerMessages: string[];
  ceoMessages: string[];
  techMessages: TechDirective[];
  stateUpdates: StateUpdate[];
  reminderDirectives: ReminderDirective[];
}

/**
 * Extract text-content directives like [POST_TO_OPS: ...] from a response.
 * Content is everything between the tag colon and the closing bracket.
 */
function extractTextDirectives(
  text: string,
  tag: string,
): { extracted: string[]; cleaned: string } {
  const results: string[] = [];
  let cleaned = text;
  const pattern = new RegExp(`\\[${tag}:\\s*([^\\]]+)\\]`, 'g');
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  cleaned = cleaned.replace(pattern, '');
  return { extracted: results, cleaned };
}

/**
 * Extract [UPDATE_STATE: {...}] directives with proper brace-counting
 * to handle nested JSON objects.
 */
function extractStateUpdates(text: string): { updates: StateUpdate[]; cleaned: string } {
  const updates: StateUpdate[] = [];
  const positions: { start: number; end: number }[] = [];

  const prefix = '[UPDATE_STATE:';
  let searchPos = 0;

  while (searchPos < text.length) {
    const start = text.indexOf(prefix, searchPos);
    if (start === -1) break;

    const braceStart = text.indexOf('{', start + prefix.length);
    if (braceStart === -1) {
      searchPos = start + prefix.length;
      continue;
    }

    // Count braces to find matching close
    let depth = 0;
    let i = braceStart;
    while (i < text.length) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }

    if (depth !== 0) {
      searchPos = start + prefix.length;
      continue;
    }

    const jsonStr = text.substring(braceStart, i + 1);

    // Find the closing bracket after the JSON
    const closeBracket = text.indexOf(']', i + 1);
    if (closeBracket === -1) {
      searchPos = start + prefix.length;
      continue;
    }

    try {
      const parsed = JSON.parse(jsonStr) as StateUpdate;
      updates.push(parsed);
      positions.push({ start, end: closeBracket + 1 });
    } catch {
      console.error('Failed to parse state update JSON:', jsonStr);
    }

    searchPos = closeBracket + 1;
  }

  // Remove directives in reverse order to preserve positions
  let cleaned = text;
  for (let i = positions.length - 1; i >= 0; i--) {
    const { start, end } = positions[i];
    cleaned = cleaned.substring(0, start) + cleaned.substring(end);
  }

  return { updates, cleaned };
}

/**
 * Extract [POST_TO_TECH(techId): message] directives from a response.
 * The techId is captured from parentheses, the message is everything up to the closing bracket.
 */
function extractTechDirectives(
  text: string,
): { extracted: TechDirective[]; cleaned: string } {
  const results: TechDirective[] = [];
  const pattern = /\[POST_TO_TECH\((\w+)\):\s*([^\]]+)\]/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push({ techId: match[1], message: match[2].trim() });
  }
  const cleaned = text.replace(pattern, '');
  return { extracted: results, cleaned };
}

/**
 * Extract [CREATE_REMINDER: {...}] directives with proper brace-counting
 * to handle nested JSON objects.
 */
function extractReminderDirectives(text: string): { reminders: ReminderDirective[]; cleaned: string } {
  const reminders: ReminderDirective[] = [];
  const positions: { start: number; end: number }[] = [];

  const prefix = '[CREATE_REMINDER:';
  let searchPos = 0;

  while (searchPos < text.length) {
    const start = text.indexOf(prefix, searchPos);
    if (start === -1) break;

    const braceStart = text.indexOf('{', start + prefix.length);
    if (braceStart === -1) {
      searchPos = start + prefix.length;
      continue;
    }

    let depth = 0;
    let i = braceStart;
    while (i < text.length) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }

    if (depth !== 0) {
      searchPos = start + prefix.length;
      continue;
    }

    const jsonStr = text.substring(braceStart, i + 1);
    const closeBracket = text.indexOf(']', i + 1);
    if (closeBracket === -1) {
      searchPos = start + prefix.length;
      continue;
    }

    try {
      const parsed = JSON.parse(jsonStr) as ReminderDirective;
      reminders.push(parsed);
      positions.push({ start, end: closeBracket + 1 });
    } catch {
      console.error('Failed to parse reminder directive JSON:', jsonStr);
    }

    searchPos = closeBracket + 1;
  }

  let cleaned = text;
  for (let i = positions.length - 1; i >= 0; i--) {
    const { start, end } = positions[i];
    cleaned = cleaned.substring(0, start) + cleaned.substring(end);
  }

  return { reminders, cleaned };
}

/**
 * Parse a Claude response for action directives.
 * Returns the visible text (directives stripped) and extracted directive payloads.
 */
export function parseDirectives(text: string): ParsedResponse {
  // Extract state updates first (they have nested braces)
  const { updates: stateUpdates, cleaned: afterState } = extractStateUpdates(text);

  // Extract reminder directives (nested braces)
  const { reminders: reminderDirectives, cleaned: afterReminders } = extractReminderDirectives(afterState);

  // Extract POST_TO_OPS directives
  const { extracted: opsMessages, cleaned: afterOps } = extractTextDirectives(
    afterReminders,
    'POST_TO_OPS',
  );

  // Extract POST_TO_CUSTOMER directives
  const { extracted: customerMessages, cleaned: afterCustomer } = extractTextDirectives(
    afterOps,
    'POST_TO_CUSTOMER',
  );

  // Extract POST_TO_CEO directives
  const { extracted: ceoMessages, cleaned: afterCeo } = extractTextDirectives(
    afterCustomer,
    'POST_TO_CEO',
  );

  // Extract POST_TO_TECH(techId) directives
  const { extracted: techMessages, cleaned: afterTech } = extractTechDirectives(
    afterCeo,
  );

  // Clean up whitespace left by directive removal
  const visibleText = afterTech
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();

  return { visibleText, opsMessages, customerMessages, ceoMessages, techMessages, stateUpdates, reminderDirectives };
}
