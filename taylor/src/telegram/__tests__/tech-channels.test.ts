import { describe, it, expect, beforeEach } from "vitest";
import {
  initTechChannels,
  getTechByGroupId,
  getGroupIdByTech,
  getTechChannels,
  getTechGroupIds,
} from "../tech-channels.js";

// Mock environment and bot for testing
function setupEnv(): void {
  process.env.TELEGRAM_TECH_GROUP_MARCUS = "-100001";
  process.env.TELEGRAM_TECH_GROUP_TYLER = "-100002";
  process.env.TELEGRAM_TECH_GROUP_JAKE = "-100003";
  process.env.TELEGRAM_TECH_GROUP_DANNY = "-100004";
}

function clearEnv(): void {
  delete process.env.TELEGRAM_TECH_GROUP_MARCUS;
  delete process.env.TELEGRAM_TECH_GROUP_TYLER;
  delete process.env.TELEGRAM_TECH_GROUP_JAKE;
  delete process.env.TELEGRAM_TECH_GROUP_DANNY;
}

// Minimal mock bot to satisfy the type
const mockBot = {
  telegram: {
    sendMessage: async () => ({}),
  },
} as any;

beforeEach(() => {
  clearEnv();
});

describe("initTechChannels", () => {
  it("loads all four tech channels from environment", () => {
    setupEnv();
    initTechChannels(mockBot);
    const channels = getTechChannels();
    expect(channels).toHaveLength(4);
    expect(channels.map((c) => c.techId)).toEqual(["marcus", "tyler", "jake", "danny"]);
  });

  it("loads only configured tech channels", () => {
    process.env.TELEGRAM_TECH_GROUP_MARCUS = "-100001";
    process.env.TELEGRAM_TECH_GROUP_JAKE = "-100003";
    initTechChannels(mockBot);
    const channels = getTechChannels();
    expect(channels).toHaveLength(2);
    expect(channels.map((c) => c.techId)).toEqual(["marcus", "jake"]);
  });

  it("loads no channels when no env vars are set", () => {
    initTechChannels(mockBot);
    const channels = getTechChannels();
    expect(channels).toHaveLength(0);
  });
});

describe("getTechByGroupId", () => {
  it("resolves a group ID to the correct tech", () => {
    setupEnv();
    initTechChannels(mockBot);
    expect(getTechByGroupId("-100001")).toBe("marcus");
    expect(getTechByGroupId("-100002")).toBe("tyler");
    expect(getTechByGroupId("-100003")).toBe("jake");
    expect(getTechByGroupId("-100004")).toBe("danny");
  });

  it("returns null for unknown group IDs", () => {
    setupEnv();
    initTechChannels(mockBot);
    expect(getTechByGroupId("-999999")).toBeNull();
  });
});

describe("getGroupIdByTech", () => {
  it("resolves a tech ID to the correct group", () => {
    setupEnv();
    initTechChannels(mockBot);
    expect(getGroupIdByTech("marcus")).toBe("-100001");
    expect(getGroupIdByTech("tyler")).toBe("-100002");
  });

  it("is case-insensitive for tech ID lookup", () => {
    setupEnv();
    initTechChannels(mockBot);
    expect(getGroupIdByTech("Marcus")).toBe("-100001");
    expect(getGroupIdByTech("TYLER")).toBe("-100002");
  });

  it("returns null for unknown tech IDs", () => {
    setupEnv();
    initTechChannels(mockBot);
    expect(getGroupIdByTech("nonexistent")).toBeNull();
  });
});

describe("getTechGroupIds", () => {
  it("returns all configured group IDs", () => {
    setupEnv();
    initTechChannels(mockBot);
    const ids = getTechGroupIds();
    expect(ids).toEqual(["-100001", "-100002", "-100003", "-100004"]);
  });
});
