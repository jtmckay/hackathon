/**
 * One-time setup: authenticate a Telegram user account via MTProto (gramjs).
 * Saves the session string to .tg-session for reuse by send.ts.
 *
 * Usage: tsx setup.ts
 */
import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const SESSION_FILE = path.join(import.meta.dirname!, ".tg-session");

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env");
    console.error("Get them from https://my.telegram.org → API development tools");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: () => prompt("Phone number (with country code, e.g. +1...): "),
    password: () => prompt("2FA password (or press enter if none): "),
    phoneCode: () => prompt("Auth code from Telegram: "),
    onError: (err) => console.error("Auth error:", err),
  });

  console.log("\nAuthenticated!");

  // Save session
  const sessionString = client.session.save() as unknown as string;
  fs.writeFileSync(SESSION_FILE, sessionString);
  console.log(`Session saved to ${SESSION_FILE}`);

  // Verify we can see the customer group
  const groupId = process.env.TELEGRAM_CUSTOMER_GROUP_ID;
  if (groupId) {
    console.log(`\nLooking for customer group ${groupId} in your dialogs...`);
    const dialogs = await client.getDialogs({ limit: 200 });
    const targetId = toGramjsId(groupId);
    const found = dialogs.find((d) => BigInt(d.id?.toString() ?? "0") === targetId);
    if (found) {
      console.log(`Found group: "${found.title}"`);
    } else {
      console.log("Group not found in your dialogs.");
      console.log("Make sure this user account has joined the customer group.");
    }
  }

  // Show current profile name
  const me = await client.getMe();
  const firstName = (me as any).firstName ?? "";
  const lastName = (me as any).lastName ?? "";
  console.log(`\nLogged in as: ${firstName} ${lastName}`.trim());
  console.log(
    'Tip: use --as <Name> with send.ts to temporarily change your display name to match a customer.',
  );

  await client.disconnect();
}

/** Convert Bot API group ID to gramjs-style positive ID */
function toGramjsId(botApiId: string): bigint {
  const id = BigInt(botApiId);
  if (id < -1000000000000n) return -id - 1000000000000n; // supergroup/channel
  if (id < 0n) return -id; // regular group
  return id;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
