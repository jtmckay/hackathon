import "dotenv/config";
import { getTechs, getCustomers, getSchedule } from "./state/state.js";

const techs = getTechs();
const customers = getCustomers();
const schedule = getSchedule();

console.log("Shamrock Plumbing agent starting...");
console.log(`Loaded ${techs.length} techs, ${customers.length} customers, ${schedule.jobs.length} jobs for ${schedule.date}`);
