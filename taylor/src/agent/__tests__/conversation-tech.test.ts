import { describe, it, expect, beforeEach } from "vitest";
import {
  addMessage,
  getHistory,
  clearHistory,
  clearAllTechHistories,
  addSystemEvent,
} from "../conversation.js";

beforeEach(() => {
  clearHistory("customer");
  clearHistory("ops");
  clearHistory("tech:marcus");
  clearHistory("tech:tyler");
  clearHistory("tech:jake");
  clearHistory("tech:danny");
});

describe("conversation — tech channels", () => {
  it("maintains independent history per tech channel", () => {
    addMessage("tech:marcus", "user", "What's my schedule?");
    addMessage("tech:tyler", "user", "On my way");

    expect(getHistory("tech:marcus")).toHaveLength(1);
    expect(getHistory("tech:marcus")[0].content).toBe("What's my schedule?");
    expect(getHistory("tech:tyler")).toHaveLength(1);
    expect(getHistory("tech:tyler")[0].content).toBe("On my way");
  });

  it("tech channel history is independent from ops and customer", () => {
    addMessage("customer", "user", "I need a plumber");
    addMessage("ops", "user", "Blake here");
    addMessage("tech:marcus", "user", "Job done");

    expect(getHistory("customer")).toHaveLength(1);
    expect(getHistory("ops")).toHaveLength(1);
    expect(getHistory("tech:marcus")).toHaveLength(1);
  });

  it("clearHistory works for tech channels", () => {
    addMessage("tech:marcus", "user", "Message 1");
    addMessage("tech:marcus", "assistant", "Response 1");
    expect(getHistory("tech:marcus")).toHaveLength(2);

    clearHistory("tech:marcus");
    expect(getHistory("tech:marcus")).toHaveLength(0);
  });

  it("clearAllTechHistories clears all tech channels but not customer/ops", () => {
    addMessage("customer", "user", "Customer message");
    addMessage("ops", "user", "Ops message");
    addMessage("tech:marcus", "user", "Marcus message");
    addMessage("tech:tyler", "user", "Tyler message");
    addMessage("tech:jake", "user", "Jake message");
    addMessage("tech:danny", "user", "Danny message");

    clearAllTechHistories();

    expect(getHistory("customer")).toHaveLength(1);
    expect(getHistory("ops")).toHaveLength(1);
    expect(getHistory("tech:marcus")).toHaveLength(0);
    expect(getHistory("tech:tyler")).toHaveLength(0);
    expect(getHistory("tech:jake")).toHaveLength(0);
    expect(getHistory("tech:danny")).toHaveLength(0);
  });

  it("addSystemEvent works for tech channels", () => {
    addSystemEvent("tech:marcus", "Dispatch order received");
    const history = getHistory("tech:marcus");
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("SYSTEM: Dispatch order received");
  });

  it("auto-creates history for new tech channels", () => {
    // First access should auto-create
    const history = getHistory("tech:marcus");
    expect(history).toEqual([]);

    // Should be able to add messages immediately
    addMessage("tech:marcus", "user", "Hello");
    expect(getHistory("tech:marcus")).toHaveLength(1);
  });
});
