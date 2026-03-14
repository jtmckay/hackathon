import { describe, it, expect, beforeEach } from "vitest";
import { buildSystemPrompt, getStaticPrompt } from "../../prompts/system-prompt.js";
import { resetToDefault, updateTechStatus, getSchedule } from "../../state/state.js";

beforeEach(() => {
  resetToDefault();
});

describe("system prompt — static section", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the agent identity", () => {
    expect(staticPrompt).toContain(
      "You are the AI dispatcher for Shamrock Plumbing",
    );
    expect(staticPrompt).toContain("You ARE the front office");
  });

  it("contains all 10 of Blake's intent statements", () => {
    const rules = [
      "Emergency calls get same-day response, no exceptions",
      "Repeat customers always get priority",
      "Never send a junior tech to an emergency alone",
      "contact the customer BEFORE doing the work",
      "Safety first",
      "Own mistakes fast",
      "Protect the relationship over the revenue",
      "Keep Blake informed but don't wait for him",
      "Techs need context",
      "After every emergency, log and learn",
    ];
    for (const rule of rules) {
      expect(staticPrompt).toContain(rule);
    }
  });

  it("contains customer satisfaction philosophy", () => {
    expect(staticPrompt).toContain("would this customer refer us");
    expect(staticPrompt).toContain(
      "Speed of acknowledgment matters as much as speed of repair",
    );
  });

  it("contains when-to-break-policy criteria", () => {
    expect(staticPrompt).toContain("Customer has demonstrated loyalty");
    expect(staticPrompt).toContain("plausibly connected to work Shamrock performed");
  });

  it("contains when-to-hold-policy criteria", () => {
    expect(staticPrompt).toContain("leads with a threat");
    expect(staticPrompt).toContain("pattern of complaints");
  });

  it("contains customer tier definitions", () => {
    expect(staticPrompt).toContain("Tier 1 (VIP)");
    expect(staticPrompt).toContain("Tier 2 (Regular)");
    expect(staticPrompt).toContain("Tier 3 (New)");
  });

  it("contains tone guidelines", () => {
    expect(staticPrompt).toContain("Sound like Blake's team");
    expect(staticPrompt).toContain("I'm sorry about the shuffle, Mrs. Garcia");
  });

  it("contains schedule design philosophy", () => {
    expect(staticPrompt).toContain("emergency buffer");
    expect(staticPrompt).toContain("Last-hour jobs should be the most bumpable");
  });

  it("contains delay notification rules", () => {
    expect(staticPrompt).toContain(
      "Never tell a customer a time that hasn't been validated by the tech",
    );
  });

  it("contains group awareness", () => {
    expect(staticPrompt).toContain("Customer group");
    expect(staticPrompt).toContain("Ops group");
    expect(staticPrompt).toContain("Never expose internal reasoning here");
  });

  it("contains reading-the-customer signals", () => {
    expect(staticPrompt).toContain("Genuine Need");
    expect(staticPrompt).toContain("Possible Exploitation");
  });
});

describe("system prompt — emergency intake & qualification", () => {
  const staticPrompt = getStaticPrompt();

  it("contains severity classification with all three levels", () => {
    expect(staticPrompt).toContain("CRITICAL");
    expect(staticPrompt).toContain("URGENT");
    expect(staticPrompt).toContain("ROUTINE");
  });

  it("lists critical signals: flooding, gas, sewage, electrical risk", () => {
    expect(staticPrompt).toContain("Active flooding");
    expect(staticPrompt).toContain("Gas smell");
    expect(staticPrompt).toContain("Sewage backup");
    expect(staticPrompt).toContain("Electrical risk near water");
  });

  it("lists urgent signals: contained leak, no hot water, single fixture backup", () => {
    expect(staticPrompt).toContain("Contained leak");
    expect(staticPrompt).toContain("No hot water");
    expect(staticPrompt).toContain("Single fixture backup");
  });

  it("lists routine signals: dripping, slow drain, running toilet, consultation", () => {
    expect(staticPrompt).toContain("Dripping faucet");
    expect(staticPrompt).toContain("Slow drain");
    expect(staticPrompt).toContain("Running toilet");
    expect(staticPrompt).toContain("Consultation or quote request");
  });

  it("instructs to classify by HIGHEST severity when multiple issues reported", () => {
    expect(staticPrompt).toContain("classify by the HIGHEST severity issue");
  });

  it("instructs to recognize urgency from non-technical language", () => {
    expect(staticPrompt).toContain("brown stuff coming up in my shower");
    expect(staticPrompt).toContain("Recognize urgency even without technical language");
  });

  it("contains gas smell safety response — evacuate and call 911 first", () => {
    expect(staticPrompt).toContain("Get everyone out of the house right now");
    expect(staticPrompt).toContain("Call 911 from outside");
  });

  it("contains electrical safety response", () => {
    expect(staticPrompt).toContain("Stay away from the water if it's near any electrical outlets");
    expect(staticPrompt).toContain("shut off the breaker for that area");
  });

  it("contains active flooding safety response with shutoff instructions", () => {
    expect(staticPrompt).toContain("main shutoff valve");
    expect(staticPrompt).toContain("Turn it clockwise or to the perpendicular position");
  });

  it("instructs safety response BEFORE any questions", () => {
    expect(staticPrompt).toContain("Safety Response — ALWAYS FIRST");
    expect(staticPrompt).toContain("your VERY FIRST words must be safety instructions");
    expect(staticPrompt).toContain("Do not ask questions first");
  });

  it("instructs calm response to panicked customers", () => {
    expect(staticPrompt).toContain("Stay calm and reassuring");
    expect(staticPrompt).toContain("Do not mirror their panic");
  });

  it("lists qualifying questions but instructs conversational use (not a checklist)", () => {
    expect(staticPrompt).toContain("Conversational, Not a Checklist");
    expect(staticPrompt).toContain("ask only the 2-3 most critical follow-up questions");
    expect(staticPrompt).toContain("Do NOT run through all of these like a form");
  });

  it("contains non-emergency handling instructions", () => {
    expect(staticPrompt).toContain("Non-Emergency (Routine) Handling");
    expect(staticPrompt).toContain("Do NOT trigger emergency flow");
  });
});

describe("system prompt — customer recognition", () => {
  const staticPrompt = getStaticPrompt();

  it("instructs greeting known customers by name and referencing their address", () => {
    expect(staticPrompt).toContain("Greet by name");
    expect(staticPrompt).toContain("Reference their address on file");
  });

  it("instructs collecting info naturally for unknown senders", () => {
    expect(staticPrompt).toContain("Unknown sender");
    expect(staticPrompt).toContain("NOT as a gating prerequisite");
  });

  it("instructs acknowledging connection to recent Shamrock work", () => {
    expect(staticPrompt).toContain("Recent Shamrock work");
    expect(staticPrompt).toContain("acknowledge the connection immediately");
    expect(staticPrompt).toContain("Never deflect");
  });
});

describe("system prompt — ops group alert formats", () => {
  const staticPrompt = getStaticPrompt();

  it("contains CRITICAL emergency alert template with POST_TO_OPS", () => {
    expect(staticPrompt).toContain("EMERGENCY INCOMING");
    expect(staticPrompt).toContain("Severity: CRITICAL");
    expect(staticPrompt).toContain("Awaiting dispatch decision");
  });

  it("contains URGENT alert template with POST_TO_OPS", () => {
    expect(staticPrompt).toContain("URGENT SERVICE REQUEST");
    expect(staticPrompt).toContain("Same-day dispatch if slot available");
    expect(staticPrompt).toContain("Checking schedule for availability");
  });

  it("contains routine log entry template", () => {
    expect(staticPrompt).toContain("Service request from");
    expect(staticPrompt).toContain("Checking schedule for next available slot");
  });

  it("contains warranty flag instructions for prior Shamrock work", () => {
    expect(staticPrompt).toContain("POTENTIAL WARRANTY");
    expect(staticPrompt).toContain("Rule #6 applies");
  });
});

describe("system prompt — information boundary", () => {
  const staticPrompt = getStaticPrompt();

  it("forbids exposing ops reasoning to customers", () => {
    expect(staticPrompt).toContain("Information Boundary");
    expect(staticPrompt).toContain("NEVER expose ops-group reasoning in customer-group responses");
  });

  it("lists specific things the customer must never see", () => {
    expect(staticPrompt).toContain("Which tech you're pulling from another job");
    expect(staticPrompt).toContain("Tier classifications or priority reasoning");
    expect(staticPrompt).toContain("Dispatch logistics or tech availability details");
  });
});

describe("system prompt — dynamic section", () => {
  it("contains the current schedule with jobs and flex buffer status", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("OPERATIONAL STATE");
    expect(prompt).toContain("TODAY'S SCHEDULE");
    expect(prompt).toContain("FLEX BUFFERS");

    // Should show all 8 jobs from schedule.json
    const schedule = getSchedule();
    expect(schedule.jobs.length).toBe(8);
    for (const job of schedule.jobs) {
      expect(prompt).toContain(job.type);
    }
  });

  it("contains tech roster information", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("TECH ROSTER");
    expect(prompt).toContain("Marcus");
    expect(prompt).toContain("Tyler");
    expect(prompt).toContain("Jake");
    expect(prompt).toContain("Danny");
  });

  it("reflects updated tech status after mutation", () => {
    updateTechStatus("marcus", "on_job", 1);
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Marcus");
    expect(prompt).toContain("on_job");
  });

  it("reflects tech status change from available to sick", () => {
    updateTechStatus("tyler", "sick");
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/Tyler.*sick/);
  });
});

describe("system prompt — dispatch decision engine", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the dispatch decision engine section header", () => {
    expect(staticPrompt).toContain("Dispatch Decision Engine");
  });

  it("contains all 6 tech evaluation criteria", () => {
    expect(staticPrompt).toContain("Skill match");
    expect(staticPrompt).toContain("Availability/interruptibility");
    expect(staticPrompt).toContain("Proximity");
    expect(staticPrompt).toContain("Current customer value");
    expect(staticPrompt).toContain("Job bumpability");
    expect(staticPrompt).toContain("Seniority");
  });

  it("specifies gas leak requires gas certified tech", () => {
    expect(staticPrompt).toContain("Gas leak → needs gas certified tech");
  });

  it("specifies water heater install cannot be safely paused", () => {
    expect(staticPrompt).toContain("water heater install mid-way CANNOT be safely paused");
  });

  it("specifies drain clearing can be paused", () => {
    expect(staticPrompt).toContain("drain clearing CAN be paused");
  });

  it("specifies junior techs are never dispatched to emergencies alone", () => {
    expect(staticPrompt).toContain("Junior techs (Danny) are NEVER dispatched to emergencies alone");
  });

  it("contains the intent hierarchy with all 5 levels", () => {
    expect(staticPrompt).toContain("Eliminate ineligible techs");
    expect(staticPrompt).toContain("Prefer techs serving lower-tier customers");
    expect(staticPrompt).toContain("Prefer closer techs");
    expect(staticPrompt).toContain("Prefer higher seniority for complex emergencies");
    expect(staticPrompt).toContain("Tiebreaker");
  });

  it("specifies tier bumping order: Tier 3 first, then Tier 2, then Tier 1", () => {
    expect(staticPrompt).toContain("Bump Tier 3 customers first, Tier 2 second, Tier 1 last");
  });

  it("contains dispatch decision post format with status indicators", () => {
    expect(staticPrompt).toContain("DISPATCH DECISION");
    expect(staticPrompt).toContain("✅ BEST OPTION");
    expect(staticPrompt).toContain("❌ ELIMINATED");
    expect(staticPrompt).toContain("⚠️ BACKUP");
  });

  it("requires line-by-line evaluation of EVERY tech", () => {
    expect(staticPrompt).toContain("line-by-line evaluation of EVERY tech");
  });

  it("instructs to reference actual data points not made-up numbers", () => {
    expect(staticPrompt).toContain("actual drive times, actual customer tiers, and actual job bumpability flags");
    expect(staticPrompt).toContain("ACTUAL drive times from the service area data — never make up numbers");
  });

  it("contains dispatch order format directed at chosen tech", () => {
    expect(staticPrompt).toContain("DISPATCH ORDER");
    expect(staticPrompt).toContain("Please confirm you're heading there");
    expect(staticPrompt).toContain("Affected customers will NOT be notified until you confirm");
  });

  it("contains displaced jobs listing in decision format", () => {
    expect(staticPrompt).toContain("Displaced jobs");
    expect(staticPrompt).toContain("Awaiting");
    expect(staticPrompt).toContain("confirmation before notifying affected customers");
  });
});

describe("system prompt — tech confirmation gate", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the confirmation gate section", () => {
    expect(staticPrompt).toContain("Tech Confirmation Gate");
  });

  it("explicitly forbids customer-facing ETAs before tech confirms", () => {
    expect(staticPrompt).toContain("must NOT notify displaced customers or give the emergency customer a specific ETA until the dispatched tech has confirmed");
  });

  it("specifies the interim message to the emergency customer", () => {
    expect(staticPrompt).toContain("I'm dispatching one of our senior technicians to you right now");
    expect(staticPrompt).toContain("I'll have a name and ETA for you shortly");
  });

  it("instructs flexible confirmation detection — not magic keywords", () => {
    expect(staticPrompt).toContain("on my way");
    expect(staticPrompt).toContain("heading out");
    expect(staticPrompt).toContain("got it");
    expect(staticPrompt).toContain("roger");
    expect(staticPrompt).toContain("leaving now");
    expect(staticPrompt).toContain("won't use a magic keyword");
  });

  it("specifies post-confirmation flow: ops update + customer ETA", () => {
    expect(staticPrompt).toContain("confirmed — en route");
    expect(staticPrompt).toContain("Send the customer a specific ETA with the tech's name");
    expect(staticPrompt).toContain("Begin notifying displaced customers");
  });

  it("specifies no-confirmation escalation", () => {
    expect(staticPrompt).toContain("has not confirmed dispatch. Blake — please advise");
    expect(staticPrompt).toContain("Do NOT send speculative ETAs to anyone");
  });

  it("instructs behavior while waiting for confirmation", () => {
    expect(staticPrompt).toContain("a tech is on the way and you'll have a specific ETA shortly");
    expect(staticPrompt).toContain("do NOT send displaced customer notifications");
  });
});

describe("system prompt — dispatch state updates", () => {
  const staticPrompt = getStaticPrompt();

  it("contains state update directives for dispatch", () => {
    expect(staticPrompt).toContain("State Updates After Dispatch");
  });

  it("includes tech status update to en_route", () => {
    expect(staticPrompt).toContain('"status": "en_route"');
  });

  it("includes current job status update to paused", () => {
    expect(staticPrompt).toContain('"status": "paused"');
  });

  it("includes adding emergency as new job", () => {
    expect(staticPrompt).toContain('"type": "add_job"');
    expect(staticPrompt).toContain("EMERGENCY DISPATCH");
  });

  it("includes marking downstream jobs for rescheduling", () => {
    expect(staticPrompt).toContain('"status": "rescheduled"');
  });

  it("includes consuming flex buffer slot", () => {
    expect(staticPrompt).toContain('"type": "consume_flex"');
  });
});

describe("system prompt — no-tech-available escalation", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the escalation section", () => {
    expect(staticPrompt).toContain("No-Tech-Available Escalation");
  });

  it("specifies escalation message to ops", () => {
    expect(staticPrompt).toContain("ESCALATION REQUIRED");
    expect(staticPrompt).toContain("No eligible tech available for emergency dispatch");
    expect(staticPrompt).toContain("Blake — need your call on this");
  });

  it("specifies reassuring message to customer during escalation", () => {
    expect(staticPrompt).toContain("I'm working on getting a technician to you as quickly as possible");
    expect(staticPrompt).toContain("I haven't forgotten about you");
  });

  it("forbids making up ETAs or dispatching unqualified tech", () => {
    expect(staticPrompt).toContain("Do NOT make up an ETA or dispatch an unqualified tech");
    expect(staticPrompt).toContain("Do NOT dispatch Danny alone to an emergency");
  });
});

describe("system prompt — cascading schedule rebuild", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the displaced job handling section", () => {
    expect(staticPrompt).toContain("Cascading Schedule Rebuild");
    expect(staticPrompt).toContain("Displaced Job Handling");
  });

  it("instructs handling displaced jobs in tier order — Tier 1 first", () => {
    expect(staticPrompt).toContain("Handle displaced jobs in customer tier order: Tier 1 first, then Tier 2, then Tier 3");
    expect(staticPrompt).toContain("VIP customers get the best available reassignment options");
  });

  it("contains reassign vs. reschedule decision tree", () => {
    expect(staticPrompt).toContain("Reassign (preferred)");
    expect(staticPrompt).toContain("Reschedule (fallback)");
  });

  it("specifies reassignment criteria: skill, open slot, not on non-interruptible job", () => {
    expect(staticPrompt).toContain("Has the skill/certification required for the job type");
    expect(staticPrompt).toContain("Has an open slot at a compatible time");
    expect(staticPrompt).toContain("NOT currently on a non-interruptible job");
  });

  it("specifies reschedule fallback: earliest slot in next 5 business days", () => {
    expect(staticPrompt).toContain("earliest available slot in the next 5 business days");
    expect(staticPrompt).toContain("Higher-tier customers get the earliest available slots");
  });

  it("includes state update directives for reassignment and rescheduling", () => {
    expect(staticPrompt).toContain('"type": "reassign_job"');
    expect(staticPrompt).toContain('"type": "job_status"');
  });

  it("triggers cascade ONLY after tech confirmation", () => {
    expect(staticPrompt).toContain("triggered ONLY after tech confirmation");
  });
});

describe("system prompt — tier-aware customer notifications", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the customer notification section", () => {
    expect(staticPrompt).toContain("Customer-Tier-Aware Notifications");
  });

  it("reinforces the confirmation gate for customer notifications", () => {
    expect(staticPrompt).toContain("ALL customer notifications happen AFTER tech confirmation");
    expect(staticPrompt).toContain("hard gate");
    expect(staticPrompt).toContain("Never notify displaced customers before the dispatched tech has confirmed");
  });

  it("contains Tier 1 VIP notification guidance — personal, references relationship", () => {
    expect(staticPrompt).toContain("Tier 1 (VIP) — Personal Apology + Priority Action");
    expect(staticPrompt).toContain("Long, warm, personal");
    expect(staticPrompt).toContain("Reference the relationship");
    expect(staticPrompt).toContain("You've been with us for years");
  });

  it("contains Tier 1 fallback when same-day not possible", () => {
    expect(staticPrompt).toContain("same-day reassignment is NOT possible for a Tier 1 customer");
    expect(staticPrompt).toContain("extra apology for not keeping it same-day");
  });

  it("contains Tier 2 Regular notification guidance — warm, solution-oriented", () => {
    expect(staticPrompt).toContain("Tier 2 (Regular) — Warm + Solution-Oriented");
    expect(staticPrompt).toContain("Acknowledge the inconvenience");
    expect(staticPrompt).toContain("Lead with the solution");
  });

  it("contains Tier 3 New notification guidance — professional, brief", () => {
    expect(staticPrompt).toContain("Tier 3 (New) — Professional + Brief");
    expect(staticPrompt).toContain("Short, professional, direct");
  });

  it("forbids mentioning emergency, other customers, or internal details in notifications", () => {
    expect(staticPrompt).toContain("NEVER mention the emergency or the other customer");
    expect(staticPrompt).toContain("NEVER share internal decision-making details");
  });
});

describe("system prompt — schedule rebuild format", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the schedule rebuild section", () => {
    expect(staticPrompt).toContain("Schedule Rebuild — Ops Group Post");
  });

  it("specifies posting after all displaced jobs are handled", () => {
    expect(staticPrompt).toContain("After ALL displaced jobs have been handled");
    expect(staticPrompt).toContain("ALL affected customers have been notified");
  });

  it("includes status indicators for schedule entries", () => {
    expect(staticPrompt).toContain("✅ NOW:");
    expect(staticPrompt).toContain("🔧 time:");
    expect(staticPrompt).toContain("➕ time:");
    expect(staticPrompt).toContain("◻️ time:");
  });

  it("includes flex buffer status in schedule rebuild", () => {
    expect(staticPrompt).toContain("FLEX STATUS");
    expect(staticPrompt).toContain("Morning buffer:");
    expect(staticPrompt).toContain("Afternoon buffer:");
  });

  it("includes displaced summary section", () => {
    expect(staticPrompt).toContain("DISPLACED SUMMARY");
    expect(staticPrompt).toContain("same-day reassignments");
    expect(staticPrompt).toContain("reschedules");
  });

  it("instructs including ALL four techs even if unchanged", () => {
    expect(staticPrompt).toContain("Include ALL four techs in the schedule");
    expect(staticPrompt).toContain("even those whose schedules didn't change");
  });
});

describe("system prompt — Blake briefing format", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the Blake briefing section", () => {
    expect(staticPrompt).toContain("Blake Briefing — Ops Group Post");
  });

  it("contains all four briefing sections: WHAT HAPPENED, WHAT I DID, WHY, RECOMMENDATION", () => {
    expect(staticPrompt).toContain("WHAT HAPPENED:");
    expect(staticPrompt).toContain("WHAT I DID:");
    expect(staticPrompt).toContain("WHY:");
    expect(staticPrompt).toContain("RECOMMENDATION:");
  });

  it("requires specific operational data in WHY section — not generic statements", () => {
    expect(staticPrompt).toContain("must reference SPECIFIC operational data");
    expect(staticPrompt).toContain("customer tier, years as customer, drive times, job bumpability flags, referral counts");
  });

  it("requires flex buffer consumption note and recommendation to rebuild", () => {
    expect(staticPrompt).toContain("Always note which flex buffer was consumed");
    expect(staticPrompt).toContain("recommend rebuilding it");
  });

  it("ends with no-action-needed unless override", () => {
    expect(staticPrompt).toContain("No action needed from you unless you want to override anything");
  });

  it("positions Blake briefing as final step after schedule rebuild", () => {
    expect(staticPrompt).toContain("After the schedule rebuild is posted, send a concise executive briefing");
  });
});

describe("system prompt — end-to-end emergency flow", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the end-to-end flow summary", () => {
    expect(staticPrompt).toContain("End-to-End Emergency Flow Summary");
  });

  it("lists all 9 steps in sequence", () => {
    expect(staticPrompt).toContain("Emergency intake");
    expect(staticPrompt).toContain("Ops alert");
    expect(staticPrompt).toContain("Dispatch decision");
    expect(staticPrompt).toContain("Tech confirmation gate");
    expect(staticPrompt).toContain("Post-confirmation notifications");
    expect(staticPrompt).toContain("Displaced job cascade");
    expect(staticPrompt).toContain("Customer notifications");
    expect(staticPrompt).toContain("Schedule rebuild");
    expect(staticPrompt).toContain("Blake briefing");
  });

  it("emphasizes complete decision chain with no gaps", () => {
    expect(staticPrompt).toContain("complete decision chain with no gaps");
  });
});

describe("system prompt — policy flex autonomous authority", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the policy flex section header", () => {
    expect(staticPrompt).toContain("Policy Flex — Autonomous Decision Authority");
  });

  it("explicitly states no Blake approval needed when four conditions met", () => {
    expect(staticPrompt).toContain("You do NOT need Blake's approval for policy flex when ALL FOUR conditions are met");
    expect(staticPrompt).toContain("Log it and move on");
    expect(staticPrompt).toContain("You DO need Blake for anything outside these bounds");
  });

  it("contains all four conditions of the policy flex check", () => {
    expect(staticPrompt).toContain("Loyalty");
    expect(staticPrompt).toContain("Plausible Connection");
    expect(staticPrompt).toContain("Proportionate Ask");
    expect(staticPrompt).toContain("No Complaint Pattern");
  });

  it("contains the policy flex ops post format with four-condition citations", () => {
    expect(staticPrompt).toContain("POLICY FLEX DECISION");
    expect(staticPrompt).toContain("FOUR-CONDITION CHECK");
    expect(staticPrompt).toContain("Per Blake's policy flex guidelines — no escalation required");
  });

  it("contains warranty-adjacent situation handling", () => {
    expect(staticPrompt).toContain("Warranty-Adjacent Situations");
    expect(staticPrompt).toContain("I can see we were out there recently — let me get this taken care of");
    expect(staticPrompt).toContain("Do NOT deflect");
    expect(staticPrompt).toContain("do NOT ask for proof");
  });

  it("contains warranty ops post format", () => {
    expect(staticPrompt).toContain("WARRANTY SITUATION");
    expect(staticPrompt).toContain("Scheduling priority fix at no charge per Rule #6");
  });
});

describe("system prompt — exploitation pattern detection", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the exploitation detection section header", () => {
    expect(staticPrompt).toContain("Exploitation Pattern Detection");
  });

  it("lists exploitation signals", () => {
    expect(staticPrompt).toContain("Pattern complainer");
    expect(staticPrompt).toContain("Threat-based demand");
    expect(staticPrompt).toContain("Disproportionate ask");
    expect(staticPrompt).toContain("Escalating pattern");
  });

  it("contains pattern complainer response flow", () => {
    expect(staticPrompt).toContain("Pattern Complainer Response");
    expect(staticPrompt).toContain("Do NOT offer a free callback");
    expect(staticPrompt).toContain("I can schedule a diagnostic visit at our standard rate");
    expect(staticPrompt).toContain("we'll absolutely make it right at no charge");
  });

  it("contains pattern flag ops post format", () => {
    expect(staticPrompt).toContain("PATTERN FLAG");
    expect(staticPrompt).toContain("Did NOT offer free service");
    expect(staticPrompt).toContain("Blake — flagging for your awareness");
  });

  it("instructs treating genuinely new issues on their own merits", () => {
    expect(staticPrompt).toContain("genuinely new and different");
    expect(staticPrompt).toContain("treat it on its own merits");
  });

  it("contains threat-based demand response flow", () => {
    expect(staticPrompt).toContain("Threat-Based Demand Response");
    expect(staticPrompt).toContain("Do NOT match the aggression");
    expect(staticPrompt).toContain("Do NOT offer free service in response to the threat");
    expect(staticPrompt).toContain("I hear you, and I definitely want to make sure you're taken care of");
  });

  it("contains threat flag ops post format", () => {
    expect(staticPrompt).toContain("THREAT FLAG");
    expect(staticPrompt).toContain("Blake — flagging for your review");
  });
});

describe("system prompt — job completion and follow-up flow", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the job completion section header", () => {
    expect(staticPrompt).toContain("Job Completion and Follow-Up Flow");
  });

  it("contains state update for tech availability after job complete", () => {
    expect(staticPrompt).toContain('"status": "available"');
    expect(staticPrompt).toContain('"currentJobId": null');
  });

  it("contains ops confirmation format", () => {
    expect(staticPrompt).toContain("completed by");
    expect(staticPrompt).toContain("is now available");
  });

  it("contains customer follow-up message template", () => {
    expect(staticPrompt).toContain("has wrapped up. How did everything go?");
  });

  it("contains review request for satisfied customers", () => {
    expect(staticPrompt).toContain("we'd really appreciate a review");
    expect(staticPrompt).toContain("helps other homeowners find reliable plumbing help");
  });

  it("contains post-completion escalation paths", () => {
    expect(staticPrompt).toContain("Policy Flex (no-charge callback if conditions are met)");
    expect(staticPrompt).toContain("Offer to schedule at standard rate");
    expect(staticPrompt).toContain("Immediate safety instructions + emergency flow");
  });
});

describe("system prompt — morning schedule review", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the morning review section header", () => {
    expect(staticPrompt).toContain("Morning Schedule Review");
  });

  it("triggers on bot startup or /morning command", () => {
    expect(staticPrompt).toContain("bot starts up or when `/morning` is sent in the ops group");
  });

  it("contains the briefing format template", () => {
    expect(staticPrompt).toContain("GOOD MORNING");
    expect(staticPrompt).toContain("TODAY'S SCHEDULE");
    expect(staticPrompt).toContain("FLEX BUFFERS");
    expect(staticPrompt).toContain("FLAGS");
    expect(staticPrompt).toContain("CUSTOMER NOTES");
  });

  it("contains briefing intelligence flags", () => {
    expect(staticPrompt).toContain("Capacity risks");
    expect(staticPrompt).toContain("VIP situations");
    expect(staticPrompt).toContain("Follow-up reminders");
    expect(staticPrompt).toContain("Reassignment opportunities");
  });
});

describe("system prompt — flex buffer lifecycle management", () => {
  const staticPrompt = getStaticPrompt();

  it("contains the flex buffer lifecycle section header", () => {
    expect(staticPrompt).toContain("Flex Buffer Lifecycle Management");
  });

  it("instructs using flex before bumping", () => {
    expect(staticPrompt).toContain("Use flex before bumping");
    expect(staticPrompt).toContain("use the flex slot BEFORE bumping any existing job");
  });

  it("contains flex consumption ops post format", () => {
    expect(staticPrompt).toContain("Flex buffer");
    expect(staticPrompt).toContain("consumed for");
    expect(staticPrompt).toContain("Recommend building a replacement buffer into tomorrow's schedule");
  });

  it("contains zero-margin warning", () => {
    expect(staticPrompt).toContain("ZERO MARGIN");
    expect(staticPrompt).toContain("Both flex buffers consumed");
    expect(staticPrompt).toContain("No emergency capacity remaining for the rest of the day");
  });

  it("instructs rebuild recommendation", () => {
    expect(staticPrompt).toContain("Tomorrow's schedule should include a");
    expect(staticPrompt).toContain("flex buffer to replace the one consumed today");
  });

  it("instructs using second buffer for second emergency", () => {
    expect(staticPrompt).toContain("Second emergency with buffer available");
    expect(staticPrompt).toContain("that's what it's for");
  });
});

describe("system prompt — full assembly", () => {
  it("includes both static and dynamic sections", () => {
    const prompt = buildSystemPrompt();
    // Static: Blake's identity
    expect(prompt).toContain("You are the AI dispatcher for Shamrock Plumbing");
    // Dynamic: operational state
    expect(prompt).toContain("OPERATIONAL STATE");
  });

  it("fits within context window with room for conversation", () => {
    const prompt = buildSystemPrompt();
    // Claude's context is 200k tokens. A rough token estimate: ~4 chars per token.
    // We want the system prompt to leave room for 50 conversation turns (~100k tokens).
    // So the system prompt should be well under 100k tokens (~400k chars).
    // In practice it should be much smaller — a few thousand tokens.
    const estimatedTokens = prompt.length / 4;
    expect(estimatedTokens).toBeLessThan(20000); // generous limit — prompt has grown with judgment layer + three-channel architecture + CEO dashboard + reminders
  });
});

describe("conversation manager", () => {
  // Import here to keep test file focused but cover the acceptance criteria
  let addMessage: typeof import("../conversation.js").addMessage;
  let getHistory: typeof import("../conversation.js").getHistory;
  let clearHistory: typeof import("../conversation.js").clearHistory;
  let addSystemEvent: typeof import("../conversation.js").addSystemEvent;

  beforeEach(async () => {
    // Re-import to get fresh module state — but since it uses module-level state,
    // we clear manually
    const mod = await import("../conversation.js");
    addMessage = mod.addMessage;
    getHistory = mod.getHistory;
    clearHistory = mod.clearHistory;
    addSystemEvent = mod.addSystemEvent;
    clearHistory("customer");
    clearHistory("ops");
  });

  it("maintains separate histories per channel", () => {
    addMessage("customer", "user", "Hello from customer");
    addMessage("ops", "user", "Hello from ops");

    expect(getHistory("customer")).toHaveLength(1);
    expect(getHistory("ops")).toHaveLength(1);
    expect(getHistory("customer")[0].content).toBe("Hello from customer");
    expect(getHistory("ops")[0].content).toBe("Hello from ops");
  });

  it("trims history to 50 messages when cap is exceeded", () => {
    for (let i = 0; i < 60; i++) {
      addMessage("customer", "user", `Message ${i}`);
    }
    const history = getHistory("customer");
    expect(history.length).toBeLessThanOrEqual(50);
    // Should have the most recent messages
    expect(history[history.length - 1].content).toBe("Message 59");
    // Oldest should be trimmed — first remaining should be message 10
    expect(history[0].content).toBe("Message 10");
  });

  it("clears history for a specific channel without affecting the other", () => {
    addMessage("customer", "user", "customer msg");
    addMessage("ops", "user", "ops msg");
    clearHistory("customer");

    expect(getHistory("customer")).toHaveLength(0);
    expect(getHistory("ops")).toHaveLength(1);
  });

  it("injects system events with SYSTEM prefix", () => {
    addSystemEvent("ops", "Tech Marcus has confirmed dispatch");
    const history = getHistory("ops");
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("SYSTEM: Tech Marcus has confirmed dispatch");
  });
});
