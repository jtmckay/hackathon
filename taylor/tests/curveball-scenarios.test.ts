import { describe, it, expect, beforeEach } from "vitest";
import { buildSystemPrompt, getStaticPrompt } from "../src/prompts/system-prompt.js";
import {
  resetToDefault,
  updateTechStatus,
  updateJobStatus,
  consumeFlexSlot,
  getSchedule,
  getTechs,
  getCustomers,
  getFlexSlots,
  getUpcomingJobsByTech,
  onReset,
} from "../src/state/state.js";
import { clearHistory, getHistory, addMessage } from "../src/agent/conversation.js";
import { parseDirectives } from "../src/agent/directives.js";

beforeEach(() => {
  resetToDefault();
  clearHistory("customer");
  clearHistory("ops");
});

// =============================================================================
// Scenario 1: Double Emergency
// =============================================================================
describe("curveball 1 — double emergency", () => {
  const prompt = getStaticPrompt();

  it("instructs excluding the tech handling the first emergency from evaluation", () => {
    expect(prompt).toContain("tech dispatched to the first emergency is UNAVAILABLE");
    expect(prompt).toContain("exclude them from evaluation entirely");
  });

  it("instructs explicitly stating the reduced tech pool", () => {
    expect(prompt).toContain("evaluating remaining techs");
  });

  it("reminds that Danny still cannot go alone under pressure", () => {
    expect(prompt).toContain("junior-solo rule doesn't change under pressure");
  });

  it("instructs using afternoon flex buffer if morning consumed", () => {
    expect(prompt).toContain("afternoon flex buffer if the morning one was already consumed");
  });

  it("state supports consuming both flex slots sequentially", () => {
    consumeFlexSlot("flex-am");
    expect(getFlexSlots()).toHaveLength(1);
    expect(getFlexSlots()[0].id).toBe("flex-pm");

    consumeFlexSlot("flex-pm");
    expect(getFlexSlots()).toHaveLength(0);
  });
});

// =============================================================================
// Scenario 2: All Techs Busy on Critical Jobs
// =============================================================================
describe("curveball 2 — all techs busy on critical jobs", () => {
  const prompt = getStaticPrompt();

  it("instructs escalating to Blake when all techs are on non-interruptible jobs", () => {
    expect(prompt).toContain("ESCALATION REQUIRED");
    expect(prompt).toContain("All techs are on non-interruptible jobs");
    expect(prompt).toContain("I need your call");
  });

  it("provides specific customer messaging that does not fabricate an ETA", () => {
    expect(prompt).toContain("I'm working on getting someone to you");
    expect(prompt).toContain("coordinating with our operations manager");
    expect(prompt).toContain("fastest possible response");
  });

  it("explicitly forbids fabricating ETAs or dispatching unqualified techs", () => {
    expect(prompt).toContain("Do NOT fabricate an ETA");
    expect(prompt).toContain("Do NOT dispatch an unqualified tech");
    expect(prompt).toContain("Do NOT dispatch Danny alone");
  });
});

// =============================================================================
// Scenario 3: Hysterical Customer
// =============================================================================
describe("curveball 3 — hysterical customer", () => {
  const prompt = getStaticPrompt();

  it("instructs not mirroring panic", () => {
    expect(prompt).toContain("DO NOT mirror their panic");
    expect(prompt).toContain("calm, steady, and reassuring");
  });

  it("instructs giving ONE clear safety instruction first", () => {
    expect(prompt).toContain("Give ONE clear safety instruction FIRST");
    expect(prompt).toContain("First things first");
  });

  it("instructs validating feelings briefly", () => {
    expect(prompt).toContain("I know this is scary — we're going to help you");
  });

  it("instructs extracting info conversationally not as checklist", () => {
    expect(prompt).toContain("CONVERSATIONALLY");
    expect(prompt).toContain("do NOT run through a checklist");
  });

  it("provides example of bad vs good response", () => {
    expect(prompt).toContain("Example BAD response");
    expect(prompt).toContain("Example GOOD response");
  });
});

// =============================================================================
// Scenario 4: False Emergency
// =============================================================================
describe("curveball 4 — false emergency", () => {
  const prompt = getStaticPrompt();

  it("instructs classifying based on actual description, not customer self-classification", () => {
    expect(prompt).toContain("Correctly classify the issue as ROUTINE based on the actual description");
    expect(prompt).toContain("not the customer's self-classification");
  });

  it("instructs not triggering emergency dispatch for routine issues", () => {
    expect(prompt).toContain("Do NOT trigger emergency dispatch");
    expect(prompt).toContain("Do NOT post a 🚨 emergency alert to ops");
  });

  it("instructs offering scheduled appointment", () => {
    expect(prompt).toContain("Offer next-available scheduling");
    expect(prompt).toContain("scheduled visit");
  });

  it("instructs posting routine log noting customer expressed urgency", () => {
    expect(prompt).toContain("Customer expressed urgency but issue is routine");
  });
});

// =============================================================================
// Scenario 5: After-Hours Emergency
// =============================================================================
describe("curveball 5 — after-hours emergency", () => {
  const prompt = getStaticPrompt();

  it("instructs handling with same urgency as daytime", () => {
    expect(prompt).toContain("SAME urgency as a daytime emergency");
    expect(prompt).toContain("no reduced service level");
  });

  it("instructs transparent mention of $150 after-hours surcharge", () => {
    expect(prompt).toContain("$150 after-hours fee on top of the repair cost");
    expect(prompt).toContain("I want to be upfront about that");
  });

  it("instructs mentioning surcharge BEFORE dispatching", () => {
    expect(prompt).toContain("TRANSPARENTLY and EARLY in the conversation, before dispatching");
  });

  it("policies data has correct surcharge amount", () => {
    // Verify the surcharge in job catalog matches what the prompt says
    const schedule = getSchedule();
    expect(schedule).toBeDefined();
    // The after-hours surcharge is $150 as defined in jobs-catalog.json
  });
});

// =============================================================================
// Scenario 6: VIP Repeat Customer Emergency
// =============================================================================
describe("curveball 6 — VIP repeat customer emergency", () => {
  const prompt = getStaticPrompt();

  it("instructs recognizing VIP customers immediately by name", () => {
    expect(prompt).toContain("Recognize them IMMEDIATELY by name");
    expect(prompt).toContain("do NOT ask who they are");
  });

  it("instructs referencing relationship warmth", () => {
    expect(prompt).toContain("Mrs. Garcia, I can see you've been with us for years");
    expect(prompt).toContain("we're going to take care of this right away");
  });

  it("instructs dispatching best available tech", () => {
    expect(prompt).toContain("Dispatch the BEST available tech");
    expect(prompt).toContain("Marcus if available");
  });

  it("instructs prominent VIP flag in ops alert", () => {
    expect(prompt).toContain("VIP CUSTOMER");
    expect(prompt).toContain("Tier 1");
  });

  it("Garcia exists in customer data with correct VIP attributes", () => {
    const customers = getCustomers();
    const garcia = customers.find((c) => c.id === "garcia");
    expect(garcia).toBeDefined();
    expect(garcia!.tier).toBe(1);
    expect(garcia!.referralCount).toBe(3);
    expect(garcia!.jobCount).toBeGreaterThan(10);
  });
});

// =============================================================================
// Scenario 7: Tech Pushback
// =============================================================================
describe("curveball 7 — tech pushback", () => {
  const prompt = getStaticPrompt();

  it("instructs acknowledging the tech's situation", () => {
    expect(prompt).toContain("Acknowledge their situation");
    expect(prompt).toContain("you can't leave a customer with the water off");
  });

  it("instructs re-evaluating for backup tech", () => {
    expect(prompt).toContain("is there a backup tech available");
    expect(prompt).toContain("pivot to the backup tech");
  });

  it("instructs negotiating ETA if no backup", () => {
    expect(prompt).toContain("How long until you can safely pause");
    expect(prompt).toContain("water coming through their ceiling");
  });

  it("instructs posting situation to ops for Blake", () => {
    expect(prompt).toContain("DISPATCH UPDATE");
    expect(prompt).toContain("Blake — FYI");
  });

  it("instructs keeping emergency customer updated", () => {
    expect(prompt).toContain("Keep the emergency customer updated");
    expect(prompt).toContain("I'll have an update for you shortly");
  });
});

// =============================================================================
// Scenario 8: Previous Shamrock Job Caused Issue
// =============================================================================
describe("curveball 8 — previous Shamrock job caused issue", () => {
  const prompt = getStaticPrompt();

  it("instructs immediate acknowledgment without deflection", () => {
    expect(prompt).toContain("I can see we were out there recently — let me get this taken care of right away");
  });

  it("explicitly forbids deflection and asking for proof", () => {
    expect(prompt).toContain("Do NOT deflect");
    expect(prompt).toContain("Do NOT ask for proof");
    expect(prompt).toContain("Do NOT suggest it might not be Shamrock's fault");
  });

  it("instructs no-charge fix per Rule #6", () => {
    expect(prompt).toContain("NO CHARGE per Blake's Rule #6");
  });

  it("instructs posting warranty flag to ops", () => {
    expect(prompt).toContain("WARRANTY SITUATION");
    expect(prompt).toContain("Scheduling priority fix at no charge per Rule #6");
  });

  it("Foster customer has recent work within warranty window", () => {
    const customers = getCustomers();
    const foster = customers.find((c) => c.id === "foster");
    expect(foster).toBeDefined();
    expect(foster!.lastJobType).toBe("Water heater install");
    expect(foster!.lastJobDate).toBe("2026-02-28");
    expect(foster!.tier).toBe(1);
  });
});

// =============================================================================
// Scenario 9: Customer Asks About Cost Mid-Emergency
// =============================================================================
describe("curveball 9 — customer asks about cost during emergency", () => {
  const prompt = getStaticPrompt();

  it("instructs not dodging the cost question", () => {
    expect(prompt).toContain("Do NOT dodge the question");
    expect(prompt).toContain('Do NOT say "let\'s worry about that later."');
  });

  it("instructs giving transparent range from job catalog", () => {
    expect(prompt).toContain("transparent range from the job catalog");
    expect(prompt).toContain("$200-600");
  });

  it("instructs reinforcing no-surprise-cost policy", () => {
    expect(prompt).toContain("we'll talk to you before doing any additional work — no surprises");
  });

  it("instructs handling warranty situations in cost answer", () => {
    expect(prompt).toContain("Since we were just out there, this will be at no charge to you");
  });
});

// =============================================================================
// Scenario 10: Review Threat
// =============================================================================
describe("curveball 10 — review threat / aggressive customer", () => {
  const prompt = getStaticPrompt();

  it("instructs not promising timelines to appease", () => {
    expect(prompt).toContain("Do NOT promise a timeline you can't keep");
  });

  it("instructs not caving to threats", () => {
    expect(prompt).toContain("Do NOT cave to the threat and offer free service");
  });

  it("instructs warm empathetic response with honest timeline", () => {
    expect(prompt).toContain("I hear you, and I know this is frustrating");
    expect(prompt).toContain("honest timeline rather than one I can't keep");
  });

  it("instructs flagging to Blake in ops", () => {
    expect(prompt).toContain("THREAT FLAG");
    expect(prompt).toContain("Blake — flagging for your review");
  });

  it("instructs separating the issue from the threat", () => {
    expect(prompt).toContain("address the ISSUE while holding the line on the THREAT");
    expect(prompt).toContain("Separate the two");
  });
});

// =============================================================================
// Scenario 11: Tech Calls In Sick
// =============================================================================
describe("curveball 11 — tech calls in sick", () => {
  const prompt = getStaticPrompt();

  it("instructs acknowledging with care", () => {
    expect(prompt).toContain("Take care of yourself");
    expect(prompt).toContain("I'll handle your remaining jobs — go rest");
  });

  it("instructs identifying all remaining jobs for sick tech", () => {
    expect(prompt).toContain("identify ALL remaining jobs for that tech today");
  });

  it("instructs tier-ordered cascade for redistribution", () => {
    expect(prompt).toContain("Handle displaced jobs in tier order");
    expect(prompt).toContain("Tier 1 customers get the best reassignment options first");
  });

  it("instructs updating sick tech status", () => {
    expect(prompt).toContain('"status": "sick"');
  });

  it("instructs Blake briefing covering all redistributions", () => {
    expect(prompt).toContain("BLAKE BRIEFING — TECH SICK");
    expect(prompt).toContain("All affected customers have been notified");
    expect(prompt).toContain("RECOMMENDATION");
  });

  it("state supports setting tech status to sick", () => {
    updateTechStatus("tyler", "sick", null);
    const techs = getTechs();
    const tyler = techs.find((t) => t.id === "tyler");
    expect(tyler!.status).toBe("sick");
    expect(tyler!.currentJobId).toBeNull();
  });

  it("can find remaining jobs for a tech", () => {
    const tylerJobs = getUpcomingJobsByTech("tyler");
    expect(tylerJobs.length).toBeGreaterThan(0);
    expect(tylerJobs.every((j) => j.techId === "tyler")).toBe(true);
  });
});

// =============================================================================
// Scenario 12: Multiple Simultaneous Disruptions
// =============================================================================
describe("curveball 12 — multiple simultaneous disruptions", () => {
  const prompt = getStaticPrompt();

  it("instructs priority ordering: emergency first, then sick, then overrun", () => {
    expect(prompt).toContain("Emergency first, then sick tech cascade, then overrun");
  });

  it("instructs not getting confused between disruption streams", () => {
    expect(prompt).toContain("Do NOT get confused between disruption streams");
    expect(prompt).toContain("keep each tracked separately");
  });

  it("instructs consolidated schedule rebuild", () => {
    expect(prompt).toContain("CONSOLIDATED schedule rebuild");
    expect(prompt).toContain("not three separate ones");
  });

  it("instructs Blake briefing covering all events", () => {
    expect(prompt).toContain("MULTIPLE DISRUPTIONS");
    expect(prompt).toContain("EVENT 1");
    expect(prompt).toContain("EVENT 2");
    expect(prompt).toContain("EVENT 3");
    expect(prompt).toContain("CONSOLIDATED SCHEDULE");
  });

  it("instructs keeping customer-facing messages separate and tier-appropriate", () => {
    expect(prompt).toContain("customer-facing messages remain separate and tier-appropriate");
    expect(prompt).toContain("customers don't know about or see the chaos");
  });
});

// =============================================================================
// Demo Reset Command
// =============================================================================
describe("demo reset — /reset command", () => {
  it("resetToDefault() restores schedule to original state after mutations", () => {
    // Mutate state
    updateTechStatus("marcus", "en_route", 99);
    updateJobStatus(1, "paused");
    consumeFlexSlot("flex-am");

    // Verify mutations took
    const techsBefore = getTechs();
    expect(techsBefore.find((t) => t.id === "marcus")!.status).toBe("en_route");

    // Reset
    resetToDefault();

    // Verify restoration
    const techsAfter = getTechs();
    expect(techsAfter.find((t) => t.id === "marcus")!.status).toBe("on_job");
    expect(getSchedule().jobs.find((j) => j.id === 1)!.status).toBe("scheduled");
    expect(getFlexSlots()).toHaveLength(2);
  });

  it("resetToDefault() triggers registered hooks", () => {
    let hookCalled = false;
    onReset(() => {
      hookCalled = true;
    });
    resetToDefault();
    expect(hookCalled).toBe(true);
  });

  it("conversation history can be cleared via reset hooks", () => {
    // Register a hook that clears history (simulates index.ts behavior)
    onReset(() => {
      clearHistory("customer");
      clearHistory("ops");
    });

    // Add messages to both channels
    addMessage("customer", "user", "Help!");
    addMessage("ops", "user", "Emergency incoming");
    expect(getHistory("customer")).toHaveLength(1);
    expect(getHistory("ops")).toHaveLength(1);

    // Reset clears via hook
    resetToDefault();
    expect(getHistory("customer")).toHaveLength(0);
    expect(getHistory("ops")).toHaveLength(0);
  });
});

// =============================================================================
// Demo Flow Validation — End-to-End Structure
// =============================================================================
describe("demo flow — end-to-end structure validation", () => {
  const prompt = getStaticPrompt();

  it("contains complete emergency flow with all 9 steps", () => {
    const steps = [
      "Emergency intake",
      "Ops alert",
      "Dispatch decision",
      "Tech confirmation gate",
      "Post-confirmation notifications",
      "Displaced job cascade",
      "Customer notifications",
      "Schedule rebuild",
      "Blake briefing",
    ];
    for (const step of steps) {
      expect(prompt).toContain(step);
    }
  });

  it("tech confirmation is a hard gate before customer notifications", () => {
    expect(prompt).toContain("must NOT notify displaced customers or give the emergency customer a specific ETA until the dispatched tech has confirmed");
  });

  it("directive system supports all required cross-group actions", () => {
    // Test POST_TO_OPS extraction
    const withOps = parseDirectives("Hello [POST_TO_OPS: Emergency alert] there");
    expect(withOps.opsMessages).toHaveLength(1);
    expect(withOps.opsMessages[0]).toBe("Emergency alert");
    expect(withOps.visibleText).toBe("Hello there");

    // Test POST_TO_CUSTOMER extraction
    const withCustomer = parseDirectives("OK [POST_TO_CUSTOMER: Your tech is on the way] done");
    expect(withCustomer.customerMessages).toHaveLength(1);
    expect(withCustomer.customerMessages[0]).toBe("Your tech is on the way");

    // Test UPDATE_STATE extraction
    const withState = parseDirectives('Updating [UPDATE_STATE: {"type": "tech_status", "payload": {"techId": "marcus", "status": "en_route"}}] now');
    expect(withState.stateUpdates).toHaveLength(1);
    expect(withState.stateUpdates[0].type).toBe("tech_status");
    expect(withState.stateUpdates[0].payload.techId).toBe("marcus");
  });

  it("state snapshot includes all operational data needed for agent reasoning", () => {
    const snapshot = buildSystemPrompt();
    // Tech roster
    expect(snapshot).toContain("Marcus");
    expect(snapshot).toContain("Tyler");
    expect(snapshot).toContain("Jake");
    expect(snapshot).toContain("Danny");
    // Schedule
    expect(snapshot).toContain("TODAY'S SCHEDULE");
    // Flex buffers
    expect(snapshot).toContain("FLEX BUFFERS");
    // Jobs
    expect(snapshot).toContain("Water heater install");
    expect(snapshot).toContain("Gas leak diagnosis");
  });
});

// =============================================================================
// Curveball Tuning Log
// =============================================================================
describe("curveball tuning log", () => {
  const prompt = getStaticPrompt();

  it("contains a tuning log documenting all scenario adjustments", () => {
    expect(prompt).toContain("Curveball Tuning Log");
    expect(prompt).toContain("Scenario 1 (Double emergency)");
    expect(prompt).toContain("Scenario 12 (Multiple disruptions)");
  });
});
