import "dotenv/config";
import { getTechs, getCustomers, getSchedule, onReset } from "./state/state.js";
import { clearHistory, clearAllTechHistories } from "./agent/conversation.js";

// Wire up conversation history clearing on state reset
onReset(() => {
  clearHistory("customer");
  clearHistory("ops");
  clearHistory("ceo");
  clearAllTechHistories();
});

const techs = getTechs();
const customers = getCustomers();
const schedule = getSchedule();

console.log("Shamrock Plumbing agent starting...");
console.log(`Loaded ${techs.length} techs, ${customers.length} customers, ${schedule.jobs.length} jobs for ${schedule.date}`);

if (process.argv.includes("--repl")) {
  const { startRepl } = await import("./repl.js");
  await startRepl();
} else {
  const { startBot } = await import("./telegram/bot.js");
  await startBot();
}
