import { describe, it, expect, beforeEach } from "vitest";
import { buildRelationshipSummary } from "../relationship-summary.js";
import { resetToDefault, getCustomerById } from "../../state/state.js";
import type { Customer } from "../../types.js";

beforeEach(() => {
  resetToDefault();
});

describe("relationship summary — Tier 1 known customer (Garcia)", () => {
  it("includes customer name", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("Garcia");
  });

  it("includes CUSTOMER CONTEXT header", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("CUSTOMER CONTEXT");
  });

  it("indicates VIP status and relationship length", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("VIP");
    expect(summary).toMatch(/\d+ year/);
    expect(summary).toContain("12 jobs completed");
  });

  it("mentions referral count", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("referred 3 other customers");
  });

  it("mentions payment history", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("pays on time");
  });

  it("includes last contact with tech name and job type", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("Marcus");
    expect(summary).toContain("Water heater");
  });

  it("includes property address", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("1284 Maple Dr");
  });

  it("includes property notes about copper plumbing", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("copper");
  });

  it("mentions tech preference (Marcus)", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("Marcus");
    expect(summary).toMatch(/request/i);
  });

  it("includes VIP-tier notes about treating like family", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    expect(summary).toContain("family");
  });

  it("reads like a colleague's briefing, not a database dump", () => {
    const garcia = getCustomerById("garcia")!;
    const summary = buildRelationshipSummary(garcia);
    // Should NOT contain raw JSON or array notation
    expect(summary).not.toContain("[{");
    expect(summary).not.toContain("}]");
    // Should contain natural language structure
    expect(summary).toContain("Relationship:");
    expect(summary).toContain("Property:");
  });
});

describe("relationship summary — Tier 2 customer (Ramirez)", () => {
  it("indicates Regular status", () => {
    const ramirez = getCustomerById("ramirez")!;
    const summary = buildRelationshipSummary(ramirez);
    expect(summary).toContain("Regular");
  });

  it("includes job count", () => {
    const ramirez = getCustomerById("ramirez")!;
    const summary = buildRelationshipSummary(ramirez);
    expect(summary).toContain("2 jobs completed");
  });
});

describe("relationship summary — new/unknown customer", () => {
  it("shows Unknown Caller header for completely new customer", () => {
    const newCustomer: Customer = {
      id: "new-test",
      name: "Unknown",
      address: "",
      phone: "",
      customerSince: null,
      tier: 3,
      lifetimeValue: 0,
      jobCount: 0,
      referralCount: 0,
      notes: "",
      complaintHistory: [],
      lastJobDate: null,
      lastJobType: null,
      communicationPreference: "text",
      paymentHistory: "good",
      serviceHistory: [],
    };
    const summary = buildRelationshipSummary(newCustomer);
    expect(summary).toContain("Unknown Caller");
  });

  it("instructs to treat as first impression", () => {
    const newCustomer: Customer = {
      id: "new-test",
      name: "Unknown",
      address: "",
      phone: "",
      customerSince: null,
      tier: 3,
      lifetimeValue: 0,
      jobCount: 0,
      referralCount: 0,
      notes: "",
      complaintHistory: [],
      lastJobDate: null,
      lastJobType: null,
      communicationPreference: "text",
      paymentHistory: "good",
      serviceHistory: [],
    };
    const summary = buildRelationshipSummary(newCustomer);
    expect(summary).toContain("first impression");
    expect(summary).toContain("make it count");
  });

  it("instructs to collect info naturally without interrogation", () => {
    const newCustomer: Customer = {
      id: "new-test",
      name: "Unknown",
      address: "",
      phone: "",
      customerSince: null,
      tier: 3,
      lifetimeValue: 0,
      jobCount: 0,
      referralCount: 0,
      notes: "",
      complaintHistory: [],
      lastJobDate: null,
      lastJobType: null,
      communicationPreference: "text",
      paymentHistory: "good",
      serviceHistory: [],
    };
    const summary = buildRelationshipSummary(newCustomer);
    expect(summary).toContain("Don't interrogate");
    expect(summary).toContain("naturally");
  });
});

describe("relationship summary — complaint pattern customer (Morris)", () => {
  it("includes complaint history warning", () => {
    const morris = getCustomerById("morris")!;
    const summary = buildRelationshipSummary(morris);
    expect(summary).toContain("Complaint history");
    expect(summary).toContain("2 prior complaint");
  });

  it("includes pattern flag warning", () => {
    const morris = getCustomerById("morris")!;
    const summary = buildRelationshipSummary(morris);
    expect(summary).toContain("Pattern flag");
  });
});

describe("relationship summary — prospective customer (Webber)", () => {
  it("treats zero-job customer as new", () => {
    const webber = getCustomerById("webber")!;
    const summary = buildRelationshipSummary(webber);
    expect(summary).toContain("New");
    expect(summary).toContain("first impression");
  });
});
