import { describe, it, expect, beforeEach } from "vitest";
import { generateMorningBriefing } from "../startup.js";
import { resetToDefault, consumeFlexSlot } from "../../state/state.js";

beforeEach(() => {
  resetToDefault();
});

describe("generateMorningBriefing", () => {
  it("returns a body and action string", () => {
    const result = generateMorningBriefing();
    expect(typeof result.body).toBe("string");
    expect(typeof result.action).toBe("string");
  });

  it("includes GOOD MORNING header with the schedule date", () => {
    const { body } = generateMorningBriefing();
    expect(body).toContain("GOOD MORNING");
    expect(body).toContain("2026");
  });

  it("includes TODAY'S SCHEDULE section", () => {
    const { body } = generateMorningBriefing();
    expect(body).toContain("TODAY'S SCHEDULE");
  });

  it("lists all four techs sorted by seniority", () => {
    const { body } = generateMorningBriefing();
    const marcusIdx = body.indexOf("Marcus");
    const tylerIdx = body.indexOf("Tyler");
    const jakeIdx = body.indexOf("Jake");
    const dannyIdx = body.indexOf("Danny");
    // Senior first, then mid, then junior
    expect(marcusIdx).toBeLessThan(tylerIdx);
    expect(tylerIdx).toBeLessThan(dannyIdx);
    expect(jakeIdx).toBeLessThan(dannyIdx);
  });

  it("shows tier and bumpability for each job", () => {
    const { body } = generateMorningBriefing();
    expect(body).toContain("Tier 1");
    expect(body).toContain("NOT bumpable");
    expect(body).toContain("bumpable");
  });

  it("includes FLEX BUFFERS section with status icons", () => {
    const { body } = generateMorningBriefing();
    expect(body).toContain("FLEX BUFFERS");
    expect(body).toContain("Morning");
    expect(body).toContain("Afternoon");
    expect(body).toContain("Available");
  });

  it("includes FLAGS section for at-risk situations", () => {
    const { body } = generateMorningBriefing();
    expect(body).toContain("FLAGS");
  });

  it("flags non-interruptible long jobs", () => {
    const { body } = generateMorningBriefing();
    // Marcus has a 3-hour non-bumpable water heater install
    expect(body).toContain("non-interruptible");
  });

  it("flags Danny as having only one job", () => {
    const { body } = generateMorningBriefing();
    expect(body).toContain("Danny has only one job");
  });

  it("includes CUSTOMER NOTES for Tier 1 VIPs", () => {
    const { body } = generateMorningBriefing();
    expect(body).toContain("CUSTOMER NOTES");
    // Garcia is Tier 1
    expect(body).toContain("Garcia (Tier 1)");
  });

  it("shows correct flex slot count in action summary", () => {
    const { action } = generateMorningBriefing();
    expect(action).toContain("2 flex slot(s) available");
    expect(action).toContain("8 jobs scheduled");
  });

  it("reflects consumed flex buffer in flags", () => {
    consumeFlexSlot("flex-am");
    const { body, action } = generateMorningBriefing();
    expect(body).toContain("Consumed");
    expect(body).toContain("flex buffer(s) already consumed");
    expect(action).toContain("1 flex slot(s) available");
  });

  it("flags zero emergency capacity when all buffers consumed", () => {
    consumeFlexSlot("flex-am");
    consumeFlexSlot("flex-pm");
    const { body, action } = generateMorningBriefing();
    expect(body).toContain("ALL flex buffers consumed");
    expect(action).toContain("0 flex slot(s) available");
  });

  it("uses 12-hour time format", () => {
    const { body } = generateMorningBriefing();
    // 08:00 should become 8:00am, 13:00 should become 1:00pm
    expect(body).toMatch(/\d{1,2}:\d{2}(am|pm)/);
  });
});
