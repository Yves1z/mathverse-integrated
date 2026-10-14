import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/integration/DELIVERY_MANIFEST.json'), 'utf8'));
let failed = 0;
for (const item of manifest.files) {
  const filename = path.join(root, item.path);
  if (!fs.existsSync(filename) || crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== item.sha256) { console.error('Changed or missing: ' + item.path); failed++; }
}
console.log(`${manifest.files.length} files checked; ${failed} changed or missing.`);
process.exitCode = failed ? 1 : 0;
