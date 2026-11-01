import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const d = dirname(fileURLToPath(import.meta.url));
let fail = 0;
for (const f of ['api.js']) { const r = spawnSync(process.execPath, [join(d, f)], { stdio: 'inherit' }); if (r.status) fail++; }
process.exit(fail ? 1 : 0);
