import { describe, it, expect } from "vitest";
import { parseDirectives } from "../directives.js";

describe("parseDirectives", () => {
  it("returns raw text when no directives present", () => {
    const result = parseDirectives("Hello, how can I help you today?");
    expect(result.visibleText).toBe("Hello, how can I help you today?");
    expect(result.opsMessages).toEqual([]);
    expect(result.customerMessages).toEqual([]);
    expect(result.stateUpdates).toEqual([]);
  });

  it("extracts POST_TO_OPS directive and strips from visible text", () => {
    const input =
      "I'll help you right away. [POST_TO_OPS: EMERGENCY INCOMING from customer] Let me ask some questions.";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe(
      "I'll help you right away. Let me ask some questions.",
    );
    expect(result.opsMessages).toEqual(["EMERGENCY INCOMING from customer"]);
  });

  it("extracts POST_TO_CUSTOMER directive and strips from visible text", () => {
    const input =
      "Dispatching Marcus now. [POST_TO_CUSTOMER: Your tech is on the way] ETA confirmed.";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Dispatching Marcus now. ETA confirmed.");
    expect(result.customerMessages).toEqual(["Your tech is on the way"]);
  });

  it("extracts UPDATE_STATE directive with valid JSON", () => {
    const input =
      'Done. [UPDATE_STATE: {"type": "tech_status", "payload": {"techId": "marcus", "status": "en_route"}}]';
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Done.");
    expect(result.stateUpdates).toEqual([
      {
        type: "tech_status",
        payload: { techId: "marcus", status: "en_route" },
      },
    ]);
  });

  it("handles UPDATE_STATE with non-JSON content gracefully", () => {
    const input = "Done. [UPDATE_STATE: mark marcus as en_route]";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Done.");
    expect(result.stateUpdates).toEqual([
      { type: "raw", payload: { value: "mark marcus as en_route" } },
    ]);
  });

  it("extracts multiple directives from a single response", () => {
    const input =
      "I see the issue. [POST_TO_OPS: Customer Garcia reporting burst pipe] Let me get help. [POST_TO_OPS: EMERGENCY — dispatch needed] We'll have someone there soon. [POST_TO_CUSTOMER: Hang tight, help is coming]";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe(
      "I see the issue. Let me get help. We'll have someone there soon.",
    );
    expect(result.opsMessages).toEqual([
      "Customer Garcia reporting burst pipe",
      "EMERGENCY — dispatch needed",
    ]);
    expect(result.customerMessages).toEqual(["Hang tight, help is coming"]);
  });

  it("handles directives at the start of the response", () => {
    const input = "[POST_TO_OPS: Alert] Here is the response.";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Here is the response.");
    expect(result.opsMessages).toEqual(["Alert"]);
  });

  it("handles directives at the end of the response", () => {
    const input = "Response text. [POST_TO_OPS: Log this event]";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Response text.");
    expect(result.opsMessages).toEqual(["Log this event"]);
  });

  it("handles mixed directive types", () => {
    const input =
      'Scheduling complete. [POST_TO_OPS: Schedule rebuilt] [POST_TO_CUSTOMER: Your appointment is confirmed for 2pm] [UPDATE_STATE: {"type": "job_status", "payload": {"jobId": 1, "status": "scheduled"}}]';
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("Scheduling complete.");
    expect(result.opsMessages).toEqual(["Schedule rebuilt"]);
    expect(result.customerMessages).toEqual([
      "Your appointment is confirmed for 2pm",
    ]);
    expect(result.stateUpdates).toEqual([
      { type: "job_status", payload: { jobId: 1, status: "scheduled" } },
    ]);
  });

  it("returns empty visible text when response is only directives", () => {
    const input = "[POST_TO_OPS: Internal note only]";
    const result = parseDirectives(input);
    expect(result.visibleText).toBe("");
    expect(result.opsMessages).toEqual(["Internal note only"]);
  });
});
