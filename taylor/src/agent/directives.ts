export interface StateUpdate {
  type: string;
  payload: Record<string, unknown>;
}

export interface TechDirective {
  techId: string;
  message: string;
}

export interface ReminderDirective {
  id: string;
  targetChannel: string;
  targetId?: string;
  triggerAt: string;
  message: string;
  context: string;
  recurrence?: { interval: string; customDays?: number; endAfter?: string };
  customerId?: string;
  jobId?: string;
  createdByRole?: string;
  createdById?: string;
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

const DIRECTIVE_PATTERN = /\[POST_TO_OPS:\s*([\s\S]*?)\]|\[POST_TO_CUSTOMER:\s*([\s\S]*?)\]|\[POST_TO_TECH\((\w+)\):\s*([\s\S]*?)\]|\[UPDATE_STATE:\s*([\s\S]*?)\]|\[POST_TO_CEO:\s*([\s\S]*?)\]|\[CREATE_REMINDER:\s*([\s\S]*?)\]/g;

/**
 * Parses Claude's response for bracketed action directives and strips them
 * from the visible text. Returns the cleaned text plus extracted directives.
 *
 * Supported directives:
 * - [POST_TO_OPS: message]
 * - [POST_TO_CUSTOMER: message]
 * - [POST_TO_TECH(techId): message]
 * - [UPDATE_STATE: JSON]
 */
export function parseDirectives(raw: string): ParsedResponse {
  const opsMessages: string[] = [];
  const customerMessages: string[] = [];
  const ceoMessages: string[] = [];
  const techMessages: TechDirective[] = [];
  const stateUpdates: StateUpdate[] = [];
  const reminderDirectives: ReminderDirective[] = [];

  const visibleText = raw
    .replace(DIRECTIVE_PATTERN, (_, ops, customer, techId, techMsg, state, ceo, reminder) => {
      if (ops !== undefined) {
        opsMessages.push(ops.trim());
      }
      if (customer !== undefined) {
        customerMessages.push(customer.trim());
      }
      if (techId !== undefined && techMsg !== undefined) {
        techMessages.push({ techId: techId.trim().toLowerCase(), message: techMsg.trim() });
      }
      if (state !== undefined) {
        try {
          const parsed = JSON.parse(state.trim());
          stateUpdates.push(parsed as StateUpdate);
        } catch {
          // If not valid JSON, store as raw update
          stateUpdates.push({ type: "raw", payload: { value: state.trim() } });
        }
      }
      if (ceo !== undefined) {
        ceoMessages.push(ceo.trim());
      }
      if (reminder !== undefined) {
        try {
          const parsed = JSON.parse(reminder.trim());
          reminderDirectives.push(parsed as ReminderDirective);
        } catch {
          console.warn("[directives] Failed to parse CREATE_REMINDER JSON:", reminder.trim());
        }
      }
      return "";
    })
    .replace(/\s{2,}/g, " ")
    .trim();

  return { visibleText, opsMessages, customerMessages, ceoMessages, techMessages, stateUpdates, reminderDirectives };
}
