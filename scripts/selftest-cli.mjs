import { runSelfTest, formatReport } from '../src/selftest.js';
const runs = Number(process.argv[2] || 10000);
const seed = Number(process.argv[3] || 42);
const t0 = Date.now();
const s = runSelfTest({ runs, seed });
console.log(formatReport(s));
console.log(`  (${Date.now() - t0} ms, seed ${seed})`);
