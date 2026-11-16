// Liga o site (porta 3000) e o servidor da competição (porta 3001) juntos: `npm run dev`.
import { spawn } from 'node:child_process';

const tasks = [
  ['site', 'npm run start'],
  ['servidor', 'npm run server'],
];

const children = tasks.map(([name, command]) => {
  const child = spawn(command, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `[${name}] ${line}`)
      .join('\n') + '\n';
  child.stdout.on('data', (c) => process.stdout.write(prefix(c)));
  child.stderr.on('data', (c) => process.stderr.write(prefix(c)));
  child.on('exit', (code) => {
    if (code) console.log(`[${name}] parou (código ${code})`);
    stopAll();
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit();
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
