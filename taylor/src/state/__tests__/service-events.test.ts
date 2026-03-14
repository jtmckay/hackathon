import { describe, it, expect, beforeEach } from "vitest";
import {
  resetToDefault,
  getCustomerById,
  appendServiceEvent,
  getServiceHistory,
  getRecentHistory,
  addCustomer,
  getCustomerByAddress,
  getCustomerByName,
  getCustomers,
} from "../state.js";
import type { ServiceEvent, Customer } from "../../types.js";

beforeEach(() => {
  resetToDefault();
});

describe("appendServiceEvent", () => {
  it("appends an event to an existing customer's service history", () => {
    const before = getServiceHistory("garcia").length;
    const event: ServiceEvent = {
      id: "test-ev-1",
      timestamp: new Date().toISOString(),
      type: "communication",
      channel: "customer",
      summary: "Test event",
    };
    appendServiceEvent("garcia", event);
    const after = getServiceHistory("garcia").length;
    expect(after).toBe(before + 1);
  });

  it("throws for unknown customer", () => {
    const event: ServiceEvent = {
      id: "test-ev-2",
      timestamp: new Date().toISOString(),
      type: "note",
      channel: "system",
      summary: "Test",
    };
    expect(() => appendServiceEvent("nonexistent", event)).toThrow(
      "Customer not found"
    );
  });

  it("events are appended in order", () => {
    const event1: ServiceEvent = {
      id: "test-ev-a",
      timestamp: "2026-01-01T10:00:00Z",
      type: "intake",
      channel: "customer",
      summary: "First event",
    };
    const event2: ServiceEvent = {
      id: "test-ev-b",
      timestamp: "2026-01-01T11:00:00Z",
      type: "completion",
      channel: "tech",
      summary: "Second event",
    };
    appendServiceEvent("johnson", event1);
    appendServiceEvent("johnson", event2);
    const history = getServiceHistory("johnson");
    const lastTwo = history.slice(-2);
    expect(lastTwo[0].id).toBe("test-ev-a");
    expect(lastTwo[1].id).toBe("test-ev-b");
  });
});

describe("getServiceHistory", () => {
  it("returns the full chronological event list for Garcia", () => {
    const history = getServiceHistory("garcia");
    expect(history.length).toBeGreaterThanOrEqual(5);
    // First event should be earliest
    expect(history[0].timestamp < history[history.length - 1].timestamp).toBe(
      true
    );
  });

  it("returns empty array for customer with no history", () => {
    const history = getServiceHistory("webber");
    expect(history).toEqual([]);
  });

  it("throws for unknown customer", () => {
    expect(() => getServiceHistory("nonexistent")).toThrow("Customer not found");
  });
});

describe("getRecentHistory", () => {
  it("returns last N events", () => {
    const recent = getRecentHistory("garcia", 3);
    expect(recent).toHaveLength(3);
    const full = getServiceHistory("garcia");
    expect(recent[2].id).toBe(full[full.length - 1].id);
  });

  it("returns all events if count exceeds history length", () => {
    const recent = getRecentHistory("johnson", 100);
    const full = getServiceHistory("johnson");
    expect(recent).toHaveLength(full.length);
  });
});

describe("addCustomer", () => {
  it("adds a new customer to the state", () => {
    const before = getCustomers().length;
    const customer: Customer = {
      id: "test-new",
      name: "TestCustomer",
      address: "123 Test St, Lehi, UT 84043",
      phone: "801-555-9999",
      customerSince: null,
      tier: 3,
      lifetimeValue: 0,
      jobCount: 0,
      referralCount: 0,
      notes: "Test",
      complaintHistory: [],
      lastJobDate: null,
      lastJobType: null,
      communicationPreference: "text",
      paymentHistory: "good",
      serviceHistory: [],
    };
    addCustomer(customer);
    expect(getCustomers().length).toBe(before + 1);
    expect(getCustomerById("test-new")).toBeDefined();
  });
});

describe("getCustomerByAddress", () => {
  it("finds Garcia by address", () => {
    const customer = getCustomerByAddress("1284 Maple Dr, Lehi, UT 84043");
    expect(customer).toBeDefined();
    expect(customer!.id).toBe("garcia");
  });

  it("is case-insensitive", () => {
    const customer = getCustomerByAddress("1284 maple dr, lehi, ut 84043");
    expect(customer).toBeDefined();
    expect(customer!.id).toBe("garcia");
  });

  it("returns undefined for unknown address", () => {
    expect(getCustomerByAddress("999 Nowhere St")).toBeUndefined();
  });
});

describe("getCustomerByName", () => {
  it("finds Garcia by name", () => {
    const customer = getCustomerByName("Garcia");
    expect(customer).toBeDefined();
    expect(customer!.id).toBe("garcia");
  });

  it("is case-insensitive", () => {
    const customer = getCustomerByName("garcia");
    expect(customer).toBeDefined();
    expect(customer!.id).toBe("garcia");
  });

  it("returns undefined for unknown name", () => {
    expect(getCustomerByName("Nobody")).toBeUndefined();
  });
});

describe("service history seeded data", () => {
  it("Garcia (Tier 1) has at least 5 service events", () => {
    const history = getServiceHistory("garcia");
    expect(history.length).toBeGreaterThanOrEqual(5);
  });

  it("Chen (Tier 1) has at least 3 service events", () => {
    const history = getServiceHistory("chen");
    expect(history.length).toBeGreaterThanOrEqual(3);
  });

  it("Patterson (Tier 1) has at least 3 service events", () => {
    const history = getServiceHistory("patterson");
    expect(history.length).toBeGreaterThanOrEqual(3);
  });

  it("Foster (Tier 1) has at least 3 service events", () => {
    const history = getServiceHistory("foster");
    expect(history.length).toBeGreaterThanOrEqual(3);
  });

  it("Ramirez (Tier 2) has service events", () => {
    const history = getServiceHistory("ramirez");
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it("Thorpe (Tier 2) has service events", () => {
    const history = getServiceHistory("thorpe");
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it("Morris service history includes complaint events", () => {
    const history = getServiceHistory("morris");
    const complaints = history.filter((e) => e.type === "complaint");
    expect(complaints.length).toBeGreaterThanOrEqual(2);
  });

  it("Garcia history tells a story — from first call to most recent", () => {
    const history = getServiceHistory("garcia");
    // First event should be the first call
    expect(history[0].summary).toContain("First call");
    // Should include the emergency
    const emergency = history.find((e) =>
      e.summary.toLowerCase().includes("emergency")
    );
    expect(emergency).toBeDefined();
    // Should include the referral
    const referral = history.find((e) => e.type === "referral");
    expect(referral).toBeDefined();
    // Should include the water heater install
    const waterHeater = history.find(
      (e) =>
        e.summary.toLowerCase().includes("water heater") &&
        e.type === "completion"
    );
    expect(waterHeater).toBeDefined();
  });
});

describe("resetToDefault clears appended events", () => {
  it("resets service history to seed data", () => {
    const beforeCount = getServiceHistory("garcia").length;
    appendServiceEvent("garcia", {
      id: "temp-ev",
      timestamp: new Date().toISOString(),
      type: "note",
      channel: "system",
      summary: "Temporary note",
    });
    expect(getServiceHistory("garcia").length).toBe(beforeCount + 1);

    resetToDefault();
    expect(getServiceHistory("garcia").length).toBe(beforeCount);
  });
});
