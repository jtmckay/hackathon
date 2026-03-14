import { describe, it, expect, beforeEach } from "vitest";
import {
  getReminders,
  getNextReminder,
  getDueReminders,
  createReminder,
  triggerReminder,
  snoozeReminder,
  cancelReminder,
  getReminderById,
  resetToDefault,
} from "../state.js";
import type { Reminder } from "../../types.js";

beforeEach(() => {
  resetToDefault();
});

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: `test-reminder-${Date.now()}`,
    createdAt: "2026-03-14T09:00:00Z",
    createdBy: { role: "system", id: "system" },
    targetChannel: "customer",
    targetId: "garcia",
    triggerAt: "2026-03-20T09:00:00Z",
    message: "Test reminder message",
    context: "Test context",
    status: "active",
    ...overrides,
  };
}

describe("seeded reminders", () => {
  it("loads 3 pre-seeded reminders", () => {
    const all = getReminders();
    expect(all).toHaveLength(3);
  });

  it("includes Garcia water heater flush reminder", () => {
    const r = getReminderById("reminder-garcia-flush");
    expect(r).toBeDefined();
    expect(r!.targetChannel).toBe("customer");
    expect(r!.targetId).toBe("garcia");
    expect(r!.status).toBe("active");
    expect(r!.recurrence?.interval).toBe("yearly");
  });

  it("includes Chen warranty reminder", () => {
    const r = getReminderById("reminder-chen-warranty");
    expect(r).toBeDefined();
    expect(r!.targetChannel).toBe("ops");
    expect(r!.customerId).toBe("chen");
  });

  it("includes Blake callback rate reminder", () => {
    const r = getReminderById("reminder-blake-danny-callbacks");
    expect(r).toBeDefined();
    expect(r!.createdBy.role).toBe("ops");
    expect(r!.createdBy.id).toBe("blake");
  });
});

describe("getReminders with filters", () => {
  it("filters by status", () => {
    const active = getReminders({ status: "active" });
    expect(active).toHaveLength(3);
    const triggered = getReminders({ status: "triggered" });
    expect(triggered).toHaveLength(0);
  });

  it("filters by targetId", () => {
    const garcia = getReminders({ targetId: "garcia" });
    expect(garcia).toHaveLength(1);
    expect(garcia[0].id).toBe("reminder-garcia-flush");
  });

  it("filters by beforeDate", () => {
    const before = getReminders({ beforeDate: "2026-03-17T00:00:00Z" });
    expect(before).toHaveLength(1); // Only Garcia's triggers on March 16
    expect(before[0].id).toBe("reminder-garcia-flush");
  });

  it("filters by role", () => {
    const ops = getReminders({ role: "ops" });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe("reminder-blake-danny-callbacks");
  });
});

describe("getNextReminder", () => {
  it("returns the soonest active reminder for a target", () => {
    const next = getNextReminder("blake");
    expect(next).toBeDefined();
    expect(next!.id).toBe("reminder-chen-warranty"); // March 18 < April 1
  });

  it("returns undefined when no reminders match", () => {
    const next = getNextReminder("nonexistent");
    expect(next).toBeUndefined();
  });
});

describe("getDueReminders", () => {
  it("returns reminders due as of a given time", () => {
    const due = getDueReminders("2026-03-17T00:00:00Z");
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe("reminder-garcia-flush");
  });

  it("returns no reminders when none are due", () => {
    const due = getDueReminders("2026-03-15T00:00:00Z");
    expect(due).toHaveLength(0);
  });

  it("returns multiple when several are due", () => {
    const due = getDueReminders("2026-04-02T00:00:00Z");
    expect(due).toHaveLength(3); // All 3 seeded reminders
  });
});

describe("createReminder", () => {
  it("adds a new reminder", () => {
    const r = makeReminder({ id: "test-new" });
    createReminder(r);
    const all = getReminders();
    expect(all).toHaveLength(4);
    expect(getReminderById("test-new")).toBeDefined();
  });
});

describe("triggerReminder", () => {
  it("marks a non-recurring reminder as triggered", () => {
    const r = getReminderById("reminder-chen-warranty");
    expect(r!.status).toBe("active");
    triggerReminder("reminder-chen-warranty");
    const updated = getReminderById("reminder-chen-warranty");
    expect(updated!.status).toBe("triggered");
  });

  it("advances a recurring reminder to the next occurrence", () => {
    const before = getReminderById("reminder-garcia-flush");
    const originalTrigger = before!.triggerAt;
    expect(before!.recurrence?.interval).toBe("yearly");

    triggerReminder("reminder-garcia-flush");

    const after = getReminderById("reminder-garcia-flush");
    expect(after!.status).toBe("active"); // Still active (recurring)
    expect(after!.triggerAt).not.toBe(originalTrigger);
    // Should be ~1 year later
    const newDate = new Date(after!.triggerAt);
    const oldDate = new Date(originalTrigger);
    expect(newDate.getFullYear()).toBe(oldDate.getFullYear() + 1);
  });

  it("throws for unknown reminder", () => {
    expect(() => triggerReminder("nonexistent")).toThrow("Reminder not found");
  });
});

describe("snoozeReminder", () => {
  it("snoozes a reminder to a new date", () => {
    snoozeReminder("reminder-chen-warranty", "2026-04-01T09:00:00Z");
    const r = getReminderById("reminder-chen-warranty");
    expect(r!.status).toBe("active");
    expect(r!.triggerAt).toBe("2026-04-01T09:00:00Z");
  });

  it("throws for unknown reminder", () => {
    expect(() => snoozeReminder("nonexistent", "2026-04-01T09:00:00Z")).toThrow("Reminder not found");
  });
});

describe("cancelReminder", () => {
  it("cancels a reminder", () => {
    cancelReminder("reminder-chen-warranty");
    const r = getReminderById("reminder-chen-warranty");
    expect(r!.status).toBe("cancelled");
  });

  it("cancelled reminders are excluded from active filters", () => {
    cancelReminder("reminder-chen-warranty");
    const active = getReminders({ status: "active" });
    expect(active).toHaveLength(2);
  });

  it("throws for unknown reminder", () => {
    expect(() => cancelReminder("nonexistent")).toThrow("Reminder not found");
  });
});

describe("resetToDefault restores seeded reminders", () => {
  it("resets all reminder mutations", () => {
    cancelReminder("reminder-chen-warranty");
    triggerReminder("reminder-garcia-flush");
    createReminder(makeReminder({ id: "extra" }));

    resetToDefault();

    const all = getReminders();
    expect(all).toHaveLength(3);
    expect(getReminderById("reminder-chen-warranty")!.status).toBe("active");
    expect(getReminderById("reminder-garcia-flush")!.status).toBe("active");
    expect(getReminderById("extra")).toBeUndefined();
  });
});

describe("state snapshot includes reminders", () => {
  it("snapshot mentions ACTIVE REMINDERS section", async () => {
    const { getStateSnapshot } = await import("../state.js");
    const snapshot = getStateSnapshot();
    expect(snapshot).toContain("ACTIVE REMINDERS");
    expect(snapshot).toContain("reminder-garcia-flush");
  });
});
