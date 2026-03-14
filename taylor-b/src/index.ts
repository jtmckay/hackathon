import 'dotenv/config';

const args = process.argv.slice(2);

if (args.includes('--repl')) {
  const { startRepl } = await import('./repl.js');
  startRepl();
} else {
  const { startBot } = await import('./telegram/bot.js');
  startBot();
}
