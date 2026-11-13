import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  base = process.argv[2] || 'http://127.0.0.1:5299/';
const VALUE_CHECKS = [];
let out = '';
try {
  out = execFileSync('node', [join(ROOT, 'src/rc3/qa/rc3_journeys.mjs'), base, join(mkdtempSync(join(tmpdir(), 'sl-')), 'fx'), 'phone'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      QA_HTTP_PASS: ''
    }
  });
} catch (e) {
  out = String(e.stdout || '');
}
const lines = out.split('\n'),
  pass = lines.filter(l => l.startsWith('PASS')),
  fail = lines.filter(l => l.startsWith('FAIL')).map(l => l.slice(6));
const unexpected = fail.filter(f => !VALUE_CHECKS.some(rx => rx.test(f)));
console.log(`fixture smoke: ${pass.length} structural checks passed · ${fail.length - unexpected.length} real-value checks differ as expected on synthetic data · ${unexpected.length} unexpected failures`);
unexpected.forEach(f => console.log('FAIL  ' + f));
if (!pass.some(l => /no page errors/.test(l))) {
  console.log('FAIL  page errors on the fixture');
  process.exit(1);
}
process.exit(unexpected.length || pass.length < 40 ? 1 : 0);
