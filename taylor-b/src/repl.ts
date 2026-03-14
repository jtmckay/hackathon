import { createInterface } from 'node:readline';
import { chat } from './agent/claude.js';
import { parseDirectives } from './agent/directives.js';
import { applyStateUpdate, type ChannelId } from './agent/state.js';

export function startRepl(): void {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'shamrock> ',
  });

  console.log('Shamrock Plumbing Dispatch — CLI REPL');
  console.log('Type "customer: <msg>" for customer channel.');
  console.log('Type "tech:<name>: <msg>" for tech channel (e.g., "tech:marcus: on my way").');
  console.log('Type anything else for ops channel.');
  console.log('Type "exit" to quit.\n');

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input === 'exit') {
      rl.close();
      return;
    }

    let channel: ChannelId = 'ops';
    let message = input;

    if (input.toLowerCase().startsWith('customer:')) {
      channel = 'customer';
      message = input.substring('customer:'.length).trim();
    } else {
      const techMatch = input.match(/^tech:(\w+):\s*(.*)/i);
      if (techMatch) {
        channel = `tech:${techMatch[1].toLowerCase()}`;
        message = techMatch[2].trim();
      }
    }

    try {
      const rawResponse = await chat(channel, message);
      const parsed = parseDirectives(rawResponse);

      console.log(`\n[${channel}] ${parsed.visibleText}`);

      if (parsed.opsMessages.length > 0) {
        console.log(`\n  → OPS: ${parsed.opsMessages.join('\n  → OPS: ')}`);
      }
      if (parsed.customerMessages.length > 0) {
        console.log(
          `\n  → CUSTOMER: ${parsed.customerMessages.join('\n  → CUSTOMER: ')}`,
        );
      }
      for (const techMsg of parsed.techMessages) {
        console.log(`\n  → TECH(${techMsg.techId}): ${techMsg.message}`);
      }
      for (const update of parsed.stateUpdates) {
        try {
          applyStateUpdate(update);
          console.log(`  → STATE: ${update.action}`);
        } catch (err) {
          console.error(`  → STATE ERROR: ${err}`);
        }
      }
      console.log('');
    } catch (err) {
      console.error('Error:', err);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}
