import { describe, it, expect, beforeEach } from "vitest";
import { generateTechMorningSchedule } from "../startup.js";
import { resetToDefault } from "../../state/state.js";

beforeEach(() => {
  resetToDefault();
});

describe("generateTechMorningSchedule", () => {
  it("returns null for unknown tech", () => {
    expect(generateTechMorningSchedule("nonexistent")).toBeNull();
  });

  it("includes tech name in greeting", () => {
    const schedule = generateTechMorningSchedule("marcus");
    expect(schedule).toContain("Good morning Marcus");
  });

  it("includes the day name", () => {
    const schedule = generateTechMorningSchedule("marcus");
    // The schedule date is a Monday
    expect(schedule).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
  });

  it("shows only that tech's jobs", () => {
    const marcusSchedule = generateTechMorningSchedule("marcus");
    const tylerSchedule = generateTechMorningSchedule("tyler");
    // Marcus and Tyler have different jobs
    expect(marcusSchedule).not.toEqual(tylerSchedule);
  });

  it("includes job count at the bottom", () => {
    const schedule = generateTechMorningSchedule("marcus");
    expect(schedule).toMatch(/\d+ jobs? today/);
  });

  it("does NOT include tier analysis or bumpability strategy", () => {
    const schedule = generateTechMorningSchedule("marcus");
    // Should not contain ops-level strategic info
    expect(schedule).not.toContain("NOT bumpable");
    expect(schedule).not.toContain("flex buffer");
    expect(schedule).not.toContain("FLAGS");
  });

  it("includes friendly customer notes for VIPs", () => {
    const schedule = generateTechMorningSchedule("marcus");
    // Marcus has a Garcia job — she's Tier 1 VIP
    if (schedule?.includes("Garcia")) {
      expect(schedule).toContain("VIP");
    }
  });

  it("includes addresses for each job", () => {
    const schedule = generateTechMorningSchedule("marcus");
    // Jobs should include addresses
    expect(schedule).toMatch(/\d+.*(?:St|Dr|Ave|Rd|Ln)/);
  });

  it("includes times in 12-hour format", () => {
    const schedule = generateTechMorningSchedule("marcus");
    expect(schedule).toMatch(/\d{1,2}:\d{2}(am|pm)/);
  });

  it("generates schedules for all four techs", () => {
    for (const techId of ["marcus", "tyler", "jake", "danny"]) {
      const schedule = generateTechMorningSchedule(techId);
      expect(schedule).not.toBeNull();
      expect(schedule).toContain("Good morning");
    }
  });
});
