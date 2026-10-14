import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const specs = [
  ['Main application', 'frontend', 'node_modules/vite/bin/vite.js', ['--host', '127.0.0.1', '--port', '5173', '--strictPort']],
  ['Four-dimensional studies', 'experiences/four-dimensional', 'node_modules/vite/bin/vite.js', []],
  ['Starships and starfields', '.', 'tools/serve-designs.mjs', []],
];
const children = specs.map(([label, directory, script, args]) => {
  const cwd = path.join(root, directory);
  const child = spawn(process.execPath, [path.join(cwd, script), ...args], { cwd, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(label + ': ' + error.message); stop(1); });
  child.on('exit', code => { if (code) stop(code); });
  return child;
});
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log('Mathverse application: http://127.0.0.1:5173');
console.log('All visual studies: http://127.0.0.1:5500');
console.log('Four-dimensional catalogue: http://127.0.0.1:5184/studies/');
console.log('The Java backend is started separately as described in docs/DEVELOPMENT.md.');
