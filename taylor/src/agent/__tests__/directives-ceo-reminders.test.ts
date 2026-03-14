import { describe, it, expect } from "vitest";
import { parseDirectives } from "../directives.js";

describe("parseDirectives — CEO messages", () => {
  it("extracts POST_TO_CEO directive and strips from visible text", () => {
    const input =
      "Here's your weekly overview. [POST_TO_CEO: 📈 WEEKLY SUMMARY — Revenue up 8%] Let me know if you need details.";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe(
      "Here's your weekly overview. Let me know if you need details.",
    );
    expect(result.ceoMessages).toEqual(["📈 WEEKLY SUMMARY — Revenue up 8%"]);
  });

  it("extracts multiple CEO messages", () => {
    const input =
      "[POST_TO_CEO: Revenue milestone — $50K this month] [POST_TO_CEO: Capacity alert — all techs booked]";
    const result = parseDirectives(input);
    expect(result.ceoMessages).toHaveLength(2);
    expect(result.ceoMessages[0]).toContain("Revenue milestone");
    expect(result.ceoMessages[1]).toContain("Capacity alert");
  });

  it("extracts CEO and ops messages simultaneously", () => {
    const input =
      "Done. [POST_TO_OPS: Dispatch complete] [POST_TO_CEO: Emergency resolved — same-day response maintained]";
    const result = parseDirectives(input);
    expect(result.opsMessages).toEqual(["Dispatch complete"]);
    expect(result.ceoMessages).toEqual([
      "Emergency resolved — same-day response maintained",
    ]);
  });
});

describe("parseDirectives — CREATE_REMINDER", () => {
  it("extracts a CREATE_REMINDER directive with valid JSON", () => {
    const reminderJson = JSON.stringify({
      id: "reminder-test-1",
      targetChannel: "customer",
      targetId: "garcia",
      triggerAt: "2026-09-16T09:00:00Z",
      message: "Time for your water filter replacement",
      context: "6-month replacement cycle",
      createdByRole: "customer",
      createdById: "garcia",
      customerId: "garcia",
    });
    const input = `I'll set that up for you. [CREATE_REMINDER: ${reminderJson}] You'll hear from us on September 16th.`;
    const result = parseDirectives(input);
    expect(result.visibleText).toBe(
      "I'll set that up for you. You'll hear from us on September 16th.",
    );
    expect(result.reminderDirectives).toHaveLength(1);
    expect(result.reminderDirectives[0].id).toBe("reminder-test-1");
    expect(result.reminderDirectives[0].targetChannel).toBe("customer");
    expect(result.reminderDirectives[0].triggerAt).toBe("2026-09-16T09:00:00Z");
  });

  it("handles invalid JSON in CREATE_REMINDER gracefully", () => {
    const input = "Done. [CREATE_REMINDER: not valid json]";
    const result = parseDirectives(input);
    expect(result.reminderDirectives).toHaveLength(0);
    expect(result.visibleText).toBe("Done.");
  });

  it("extracts reminder alongside other directives", () => {
    const reminderJson = JSON.stringify({
      id: "reminder-test-2",
      targetChannel: "ops",
      targetId: "blake",
      triggerAt: "2026-04-16T08:00:00Z",
      message: "Check Danny's callback rate",
      context: "Blake requested monthly review",
    });
    const input = `Got it. [POST_TO_OPS: Reminder set for Blake] [CREATE_REMINDER: ${reminderJson}] I'll flag it on April 16th.`;
    const result = parseDirectives(input);
    expect(result.opsMessages).toHaveLength(1);
    expect(result.reminderDirectives).toHaveLength(1);
    expect(result.reminderDirectives[0].targetId).toBe("blake");
  });
});
