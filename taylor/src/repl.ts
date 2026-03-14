import * as readline from "readline";
import { initClaudeClient, chat } from "./agent/claude-client.js";
import { clearHistory, clearAllTechHistories, type Channel } from "./agent/conversation.js";
import { getStateSnapshot, resetToDefault, onReset, getReminders } from "./state/state.js";
import { generateMorningBriefing, generateTechMorningSchedule, generateDailyCeoSummary, generateWeeklyCeoSummary } from "./telegram/startup.js";
import { getUpcomingRemindersSummary, getActiveRemindersSummary } from "./agent/reminders.js";

const TECH_IDS = ["marcus", "tyler", "jake", "danny"];

export async function startRepl(): Promise<void> {
  initClaudeClient();

  // Register conversation clear hook for reset (idempotent with index.ts registration)
  onReset(() => {
    clearHistory("customer");
    clearHistory("ops");
    clearHistory("ceo");
    clearAllTechHistories();
  });

  let channel: Channel = "customer";

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function prompt(): void {
    rl.question(`[${channel}] > `, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed === "/quit") {
        console.log("Goodbye!");
        rl.close();
        process.exit(0);
      }

      if (trimmed === "/switch") {
        // Cycle: customer → ops → ceo → tech:marcus → tech:tyler → tech:jake → tech:danny → customer
        if (channel === "customer") {
          channel = "ops";
        } else if (channel === "ops") {
          channel = "ceo";
        } else if (channel === "ceo") {
          channel = "tech:marcus";
        } else if (channel.startsWith("tech:")) {
          const currentTech = channel.slice(5);
          const idx = TECH_IDS.indexOf(currentTech);
          if (idx >= 0 && idx < TECH_IDS.length - 1) {
            channel = `tech:${TECH_IDS[idx + 1]}`;
          } else {
            channel = "customer";
          }
        } else {
          channel = "customer";
        }
        console.log(`Switched to ${channel} channel`);
        prompt();
        return;
      }

      // Direct tech channel switch: /tech marcus
      if (trimmed.startsWith("/tech ")) {
        const techName = trimmed.slice(6).toLowerCase().trim();
        if (TECH_IDS.includes(techName)) {
          channel = `tech:${techName}`;
          console.log(`Switched to ${channel} channel`);
        } else {
          console.log(`Unknown tech: ${techName}. Available: ${TECH_IDS.join(", ")}`);
        }
        prompt();
        return;
      }

      if (trimmed === "/state") {
        console.log("\n" + getStateSnapshot() + "\n");
        prompt();
        return;
      }

      if (trimmed === "/reset") {
        resetToDefault();
        console.log("State and conversation history reset to defaults.");
        prompt();
        return;
      }

      if (trimmed === "/morning") {
        const { body, action } = generateMorningBriefing();
        console.log(`\n=== OPS BRIEFING ===\n${body}\n\n${action}\n`);

        // Also show per-tech schedules
        for (const techId of TECH_IDS) {
          const techSchedule = generateTechMorningSchedule(techId);
          if (techSchedule) {
            console.log(`\n=== ${techId.toUpperCase()}'S CHANNEL ===\n${techSchedule}\n`);
          }
        }
        prompt();
        return;
      }

      if (trimmed === "/daily") {
        const summary = generateDailyCeoSummary();
        console.log(`\n=== CEO DAILY SUMMARY ===\n${summary}\n`);
        prompt();
        return;
      }

      if (trimmed === "/weekly") {
        const summary = generateWeeklyCeoSummary();
        console.log(`\n=== CEO WEEKLY SUMMARY ===\n${summary}\n`);
        prompt();
        return;
      }

      if (trimmed === "/reminders") {
        console.log(`\n=== REMINDERS ===`);
        console.log(getActiveRemindersSummary());
        console.log("");
        console.log(getUpcomingRemindersSummary(14));
        console.log("");
        prompt();
        return;
      }

      try {
        const response = await chat(channel, trimmed);
        console.log(`\n${response}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}\n`);
      }

      prompt();
    });
  }

  console.log("Shamrock Plumbing Dispatch Agent — REPL Mode");
  console.log("Commands: /switch (cycle channels), /tech <name> (switch to tech channel), /state, /morning, /daily, /weekly, /reminders, /reset, /quit");
  console.log(`Available tech channels: ${TECH_IDS.join(", ")}`);
  console.log(`Channels: customer → ops → ceo → tech:marcus → ... → customer`);
  console.log(`Starting in [${channel}] channel\n`);

  prompt();
}
