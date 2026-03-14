/**
 * Send a message to the Telegram customer group as a regular user.
 * The bot cannot distinguish this from a real customer.
 *
 * Usage:
 *   tsx send.ts "Hi, my kitchen sink is leaking"
 *   tsx send.ts --as Garcia "Hi, my kitchen sink is leaking"
 *
 * --as <Name>  Temporarily changes the Telegram profile first_name
 *              so the bot recognizes you as that customer, then restores
 *              your original name after sending.
 */
import "dotenv/config";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as fs from "fs";
import * as path from "path";

const SESSION_FILE = path.join(import.meta.dirname!, ".tg-session");

async function main() {
  const args = process.argv.slice(2);

  // Parse --as <name>
  let spoofName: string | null = null;
  const asIdx = args.indexOf("--as");
  if (asIdx !== -1) {
    spoofName = args[asIdx + 1];
    if (!spoofName) {
      console.error("--as requires a name, e.g. --as Garcia");
      process.exit(1);
    }
    args.splice(asIdx, 2);
  }

  const message = args.join(" ");
  if (!message) {
    console.error("Usage: tsx send.ts [--as <Name>] <message>");
    console.error('  tsx send.ts "My water heater is making strange noises"');
    console.error('  tsx send.ts --as Garcia "Hi, my kitchen sink is leaking"');
    process.exit(1);
  }

  // Validate env
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const groupId = process.env.TELEGRAM_CUSTOMER_GROUP_ID;

  if (!apiId || !apiHash) {
    console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env");
    process.exit(1);
  }
  if (!groupId) {
    console.error("Set TELEGRAM_CUSTOMER_GROUP_ID in .env");
    process.exit(1);
  }

  // Load session
  if (!fs.existsSync(SESSION_FILE)) {
    console.error("No session found. Run setup first: tsx setup.ts");
    process.exit(1);
  }
  const sessionString = fs.readFileSync(SESSION_FILE, "utf-8").trim();

  // Connect
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();

  // Spoof display name if requested
  let originalFirstName: string | undefined;
  if (spoofName) {
    const me = await client.getMe();
    originalFirstName = (me as any).firstName ?? "";
    await client.invoke(
      new Api.account.UpdateProfile({ firstName: spoofName, lastName: "" }),
    );
    console.log(`Display name → "${spoofName}"`);
  }

  try {
    // Resolve the customer group from dialogs
    const entity = await resolveGroup(client, groupId);

    // Send the message
    await client.sendMessage(entity, { message });
    console.log(`Sent to customer group: ${message}`);
  } finally {
    // Restore original name
    if (spoofName && originalFirstName !== undefined) {
      await client.invoke(
        new Api.account.UpdateProfile({ firstName: originalFirstName }),
      );
      console.log(`Display name restored → "${originalFirstName}"`);
    }
    await client.disconnect();
  }
}

/** Resolve the Bot API group ID to a gramjs entity via dialog cache */
async function resolveGroup(client: TelegramClient, botApiGroupId: string) {
  const dialogs = await client.getDialogs({ limit: 200 });
  const targetId = toGramjsId(botApiGroupId);

  const dialog = dialogs.find((d) => BigInt(d.id?.toString() ?? "0") === targetId);
  if (!dialog?.entity) {
    console.error(`Group ${botApiGroupId} not found in dialogs.`);
    console.error("Make sure the user account has joined the customer group.");
    process.exit(1);
  }

  return dialog.entity;
}

/** Convert Bot API group ID to gramjs-style positive ID */
function toGramjsId(botApiId: string): bigint {
  const id = BigInt(botApiId);
  if (id < -1000000000000n) return -id - 1000000000000n;
  if (id < 0n) return -id;
  return id;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
