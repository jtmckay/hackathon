import { describe, it, expect } from "vitest";
import { parseDirectives } from "../directives.js";

describe("parseDirectives — POST_TO_TECH", () => {
  it("extracts POST_TO_TECH directive with tech ID", () => {
    const input =
      "Dispatching now. [POST_TO_TECH(marcus): 📋 EMERGENCY DISPATCH\n\nAddress: 742 Lakeside Dr]";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Dispatching now.");
    expect(result.techMessages).toHaveLength(1);
    expect(result.techMessages[0].techId).toBe("marcus");
    expect(result.techMessages[0].message).toContain("EMERGENCY DISPATCH");
    expect(result.techMessages[0].message).toContain("742 Lakeside Dr");
  });

  it("extracts multiple POST_TO_TECH directives for different techs", () => {
    const input =
      "Redistributing. [POST_TO_TECH(tyler): You've got a new job at 2pm] [POST_TO_TECH(jake): Your schedule is unchanged]";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Redistributing.");
    expect(result.techMessages).toHaveLength(2);
    expect(result.techMessages[0].techId).toBe("tyler");
    expect(result.techMessages[1].techId).toBe("jake");
  });

  it("handles POST_TO_TECH alongside other directives", () => {
    const input =
      'Decision made. [POST_TO_OPS: 🔧 DISPATCH DECISION — pulling Marcus] [POST_TO_TECH(marcus): Head to 742 Lakeside Dr] [POST_TO_CUSTOMER: Help is on the way] [UPDATE_STATE: {"type": "tech_status", "payload": {"techId": "marcus", "status": "en_route"}}]';
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Decision made.");
    expect(result.opsMessages).toHaveLength(1);
    expect(result.techMessages).toHaveLength(1);
    expect(result.techMessages[0].techId).toBe("marcus");
    expect(result.customerMessages).toHaveLength(1);
    expect(result.stateUpdates).toHaveLength(1);
  });

  it("lowercases the tech ID", () => {
    const input = "[POST_TO_TECH(Marcus): Your next job is at 3pm]";
    const result = parseDirectives(input);
    expect(result.techMessages[0].techId).toBe("marcus");
  });

  it("returns empty techMessages when no POST_TO_TECH directives present", () => {
    const input = "Hello, how can I help? [POST_TO_OPS: Customer inquiry]";
    const result = parseDirectives(input);
    expect(result.techMessages).toEqual([]);
  });

  it("handles POST_TO_TECH as the only content", () => {
    const input = "[POST_TO_TECH(danny): Good morning Danny, here's your schedule]";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("");
    expect(result.techMessages).toHaveLength(1);
    expect(result.techMessages[0].techId).toBe("danny");
  });
});
