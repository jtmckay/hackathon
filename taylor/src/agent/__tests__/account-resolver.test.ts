import { describe, it, expect, beforeEach } from "vitest";
import { resolveAccount } from "../account-resolver.js";
import {
  resetToDefault,
  getCustomerById,
  getCustomers,
} from "../../state/state.js";

beforeEach(() => {
  resetToDefault();
});

describe("account resolver — known customer matching", () => {
  it("resolves by explicit customer ID in metadata", () => {
    const result = resolveAccount("Hello, I need help", "customer", {
      customerId: "garcia",
    });
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe("garcia");
  });

  it("resolves by name mention — Mrs. Garcia", () => {
    const result = resolveAccount(
      "Hi, this is Mrs. Garcia, my water heater is making noise",
      "customer"
    );
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe("garcia");
  });

  it("resolves by name mention — Mr. Chen", () => {
    const result = resolveAccount(
      "This is Mr. Chen calling about a leak",
      "customer"
    );
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe("chen");
  });

  it("resolves by name mention — bare last name", () => {
    const result = resolveAccount(
      "Hey, Patterson here. My drain is backing up again.",
      "customer"
    );
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe("patterson");
  });

  it("resolves by address mention", () => {
    const result = resolveAccount(
      "I'm at 1284 Maple Dr and my basement is flooding!",
      "customer"
    );
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe("garcia");
  });

  it("resolves by address mention — Chen's address", () => {
    const result = resolveAccount(
      "We're at 567 Oak Ave and need a plumber",
      "customer"
    );
    expect(result.isNew).toBe(false);
    expect(result.customer.id).toBe("chen");
  });
});

describe("account resolver — new customer creation", () => {
  it("creates a provisional account when no match is found", () => {
    const initialCount = getCustomers().length;
    const result = resolveAccount(
      "Hi, I found you on Google. My toilet is overflowing.",
      "customer"
    );
    expect(result.isNew).toBe(true);
    expect(result.customer.tier).toBe(3);
    expect(result.customer.name).toBe("Unknown");
    expect(result.customer.notes).toContain("Provisional account");
    expect(getCustomers().length).toBe(initialCount + 1);
  });

  it("provisional account has an initial service event", () => {
    const result = resolveAccount(
      "Need help with a plumbing issue",
      "customer"
    );
    expect(result.customer.serviceHistory.length).toBe(1);
    expect(result.customer.serviceHistory[0].type).toBe("intake");
  });
});

describe("account resolver — tech context resolution", () => {
  it("resolves customer from tech sender context on ops channel", () => {
    // Marcus is currently on job 1 which is for a customer
    const result = resolveAccount(
      "The homeowner here says the leak is getting worse",
      "ops",
      { senderContext: "this message is from tech Marcus" }
    );
    // Marcus's current job (job 1) should map to a customer
    expect(result.isNew).toBe(false);
  });
});

describe("account resolver — priority order", () => {
  it("prefers explicit ID over name matching", () => {
    const result = resolveAccount(
      "This is Mrs. Garcia calling",
      "customer",
      { customerId: "chen" }
    );
    expect(result.customer.id).toBe("chen");
  });
});
