import { describe, it, expect, beforeEach } from "vitest";
import {
  getTechs,
  getCustomers,
  getSchedule,
  getJobsCatalog,
  getServiceArea,
  getPolicies,
  getTechById,
  getCustomerById,
  getJobsByTech,
  getUpcomingJobsByTech,
  getCustomerTier,
  getDriveTime,
  getFlexSlots,
  updateTechStatus,
  updateJobStatus,
  addJobToSchedule,
  removeJobFromSchedule,
  reassignJob,
  consumeFlexSlot,
  resetToDefault,
  getStateSnapshot,
} from "../state.js";

beforeEach(() => {
  resetToDefault();
});

describe("read accessors", () => {
  it("getTechs returns exactly 4 techs", () => {
    const techs = getTechs();
    expect(techs).toHaveLength(4);
    expect(techs.map((t) => t.id)).toEqual(["marcus", "tyler", "jake", "danny"]);
  });

  it("getCustomers returns at least 10 customers spanning all tiers", () => {
    const customers = getCustomers();
    expect(customers.length).toBeGreaterThanOrEqual(10);
    const tiers = new Set(customers.map((c) => c.tier));
    expect(tiers).toContain(1);
    expect(tiers).toContain(2);
    expect(tiers).toContain(3);
  });

  it("getSchedule returns 8 jobs and 2 flex slots", () => {
    const schedule = getSchedule();
    expect(schedule.jobs).toHaveLength(8);
    expect(schedule.flexSlots).toHaveLength(2);
    expect(schedule.date).toBe("2026-03-16");
  });

  it("getJobsCatalog returns emergency and routine entries", () => {
    const catalog = getJobsCatalog();
    expect(catalog.emergency.length).toBeGreaterThan(0);
    expect(catalog.routine.length).toBeGreaterThan(0);
    expect(catalog.afterHoursSurcharge).toBe(150);
  });

  it("getServiceArea returns drive time entries", () => {
    const area = getServiceArea();
    expect(area.length).toBeGreaterThan(0);
    expect(area[0]).toHaveProperty("from");
    expect(area[0]).toHaveProperty("to");
    expect(area[0]).toHaveProperty("minutes");
  });

  it("getPolicies returns business policies", () => {
    const policies = getPolicies();
    expect(policies.warranty.standardDays).toBe(30);
    expect(policies.emergencyResponse.guarantee).toBe("same-day, no exceptions");
  });
});

describe("query helpers", () => {
  it("getTechById returns the correct tech", () => {
    const marcus = getTechById("marcus");
    expect(marcus).toBeDefined();
    expect(marcus!.name).toBe("Marcus");
    expect(marcus!.seniority).toBe("senior");
  });

  it("getTechById returns undefined for unknown id", () => {
    expect(getTechById("nobody")).toBeUndefined();
  });

  it("getCustomerById returns the correct customer", () => {
    const garcia = getCustomerById("garcia");
    expect(garcia).toBeDefined();
    expect(garcia!.tier).toBe(1);
  });

  it("getJobsByTech returns jobs for a specific tech", () => {
    const tylerJobs = getJobsByTech("tyler");
    expect(tylerJobs.length).toBeGreaterThan(0);
    expect(tylerJobs.every((j) => j.techId === "tyler")).toBe(true);
  });

  it("getUpcomingJobsByTech returns only scheduled/in_progress jobs", () => {
    const upcoming = getUpcomingJobsByTech("marcus");
    expect(upcoming.length).toBeGreaterThan(0);
    expect(
      upcoming.every((j) => j.status === "scheduled" || j.status === "in_progress")
    ).toBe(true);
  });

  it("getCustomerTier returns the correct tier", () => {
    expect(getCustomerTier("garcia")).toBe(1);
    expect(getCustomerTier("ramirez")).toBe(2);
    expect(getCustomerTier("johnson")).toBe(3);
  });

  it("getCustomerTier returns undefined for unknown customer", () => {
    expect(getCustomerTier("nobody")).toBeUndefined();
  });

  it("getDriveTime returns drive time between areas", () => {
    const time = getDriveTime("Lehi", "Saratoga Springs");
    expect(time).toBeDefined();
    expect(typeof time).toBe("number");
    expect(time).toBeGreaterThan(0);
  });

  it("getDriveTime works in both directions", () => {
    const ab = getDriveTime("Lehi", "Orem");
    const ba = getDriveTime("Orem", "Lehi");
    expect(ab).toBe(ba);
  });

  it("getDriveTime returns 0 for same location", () => {
    expect(getDriveTime("Lehi", "Lehi")).toBe(0);
  });

  it("getFlexSlots returns 2 available slots initially", () => {
    const slots = getFlexSlots();
    expect(slots).toHaveLength(2);
    expect(slots.some((s) => s.time < "12:00")).toBe(true);
    expect(slots.some((s) => s.time >= "12:00")).toBe(true);
  });
});

describe("mutation methods", () => {
  it("updateTechStatus changes tech status", () => {
    updateTechStatus("marcus", "available", null);
    const marcus = getTechById("marcus");
    expect(marcus!.status).toBe("available");
    expect(marcus!.currentJobId).toBeNull();
  });

  it("updateTechStatus throws for unknown tech", () => {
    expect(() => updateTechStatus("nobody", "available")).toThrow("Tech not found");
  });

  it("updateJobStatus changes job status", () => {
    updateJobStatus(1, "in_progress");
    const schedule = getSchedule();
    const job = schedule.jobs.find((j) => j.id === 1);
    expect(job!.status).toBe("in_progress");
  });

  it("updateJobStatus throws for unknown job", () => {
    expect(() => updateJobStatus(999, "completed")).toThrow("Job not found");
  });

  it("addJobToSchedule adds a new job", () => {
    const newJob = {
      id: 100,
      techId: "marcus",
      time: "15:00",
      durationHrs: 1,
      type: "Emergency repair",
      customerId: "garcia",
      address: "1284 Maple Dr, Lehi, UT 84043",
      status: "scheduled" as const,
      notes: "Emergency",
      bumpable: false,
    };
    addJobToSchedule(newJob);
    const schedule = getSchedule();
    expect(schedule.jobs).toHaveLength(9);
    expect(schedule.jobs.find((j) => j.id === 100)).toBeDefined();
  });

  it("removeJobFromSchedule removes a job", () => {
    removeJobFromSchedule(1);
    const schedule = getSchedule();
    expect(schedule.jobs).toHaveLength(7);
    expect(schedule.jobs.find((j) => j.id === 1)).toBeUndefined();
  });

  it("removeJobFromSchedule throws for unknown job", () => {
    expect(() => removeJobFromSchedule(999)).toThrow("Job not found");
  });

  it("reassignJob changes tech and optionally time", () => {
    reassignJob(3, "jake", "09:30");
    const schedule = getSchedule();
    const job = schedule.jobs.find((j) => j.id === 3);
    expect(job!.techId).toBe("jake");
    expect(job!.time).toBe("09:30");
  });

  it("reassignJob throws for unknown job", () => {
    expect(() => reassignJob(999, "marcus")).toThrow("Job not found");
  });

  it("consumeFlexSlot marks slot as consumed", () => {
    consumeFlexSlot("flex-am");
    const slots = getFlexSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe("flex-pm");
  });

  it("consumeFlexSlot throws for unknown slot", () => {
    expect(() => consumeFlexSlot("flex-nonexistent")).toThrow("Flex slot not found");
  });
});

describe("resetToDefault", () => {
  it("reverts all mutations", () => {
    updateTechStatus("marcus", "available", null);
    updateJobStatus(1, "completed");
    consumeFlexSlot("flex-am");

    resetToDefault();

    const marcus = getTechById("marcus");
    expect(marcus!.status).toBe("on_job");
    expect(marcus!.currentJobId).toBe(1);

    const schedule = getSchedule();
    const job = schedule.jobs.find((j) => j.id === 1);
    expect(job!.status).toBe("scheduled");

    const slots = getFlexSlots();
    expect(slots).toHaveLength(2);
  });
});

describe("getStateSnapshot", () => {
  it("returns a formatted string with key operational data", () => {
    const snapshot = getStateSnapshot();
    expect(typeof snapshot).toBe("string");
    expect(snapshot).toContain("SHAMROCK PLUMBING");
    expect(snapshot).toContain("2026-03-16");
    expect(snapshot).toContain("Marcus");
    expect(snapshot).toContain("TECH ROSTER");
    expect(snapshot).toContain("SCHEDULE");
    expect(snapshot).toContain("FLEX BUFFERS");
  });
});

describe("complaint history customer", () => {
  it("morris has at least 2 complaints", () => {
    const morris = getCustomerById("morris");
    expect(morris).toBeDefined();
    expect(morris!.complaintHistory.length).toBeGreaterThanOrEqual(2);
  });
});
