// Randomiseret selvtest af force-motoren. Kører både i Node (npm test) og i appens hemmelige panel.
import { Calculator, tokensText } from './calculator.js';
import { evaluate } from './force.js';
import { formatNumber, parseDisplay } from './format.js';
import { ddmmyy } from './settings.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POSTNUMRE = ['1050', '1360', '1620', '2100', '2200', '2300', '2400', '2450', '2500', '2700', '2720', '2770', '2800', '2900', '2990', '3000', '4000', '5000', '6000', '7100', '8000', '9000'];

export function makeGen(rand) {
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[int(0, arr.length - 1)];
  return {
    int, pick,
    birthday: () => ddmmyy(new Date(int(1950, 2015), int(0, 11), int(1, 28))).replace(/^0+/, ''),
    postnr: () => pick(POSTNUMRE),
    lotto: () => {
      const s = new Set();
      while (s.size < 7) s.add(int(1, 36));
      return [...s].sort((a, b) => a - b).map(String);
    },
    receipt: () => `${int(3, 899)},${String(int(0, 99)).padStart(2, '0')}`.replace(/,00$/, ''),
    small: () => String(int(1, 99)),
    any: () => String(int(1, 999999)),
  };
}

function typeNumber(text) {
  return text.split('');
}

// Lav et tilfældigt "tilskuer-regnestykke": liste af tal + operatorer
function scenario(g) {
  const kind = g.pick(['bday-post', 'lotto', 'netto', 'mix', 'mul', 'div', 'chain']);
  let nums;
  let ops;
  switch (kind) {
    case 'bday-post': nums = [g.birthday(), g.postnr()]; ops = ['+']; break;
    case 'lotto': nums = g.lotto(); ops = Array(6).fill('+'); break;
    case 'netto': nums = Array.from({ length: g.int(2, 6) }, g.receipt); ops = Array(nums.length - 1).fill('+'); break;
    case 'mul': nums = [g.birthday()]; ops = []; break;
    case 'div': nums = [g.birthday()]; ops = []; break;
    case 'chain': {
      nums = Array.from({ length: g.int(1, 5) }, () => g.pick([g.small(), g.any(), g.receipt(), g.postnr()]));
      ops = Array.from({ length: nums.length - 1 }, () => g.pick(['+', '+', '-', '×', '÷']));
      break;
    }
    default: nums = [g.birthday(), g.postnr(), g.small()]; ops = ['+', g.pick(['+', '-', '×'])];
  }
  // operatoren foran det tal, der streames
  const forceOp = kind === 'mul' ? '×' : kind === 'div' ? '÷' : g.pick(['+', '+', '+', '-', '×', '÷']);
  return { kind, nums, ops, forceOp };
}

function makeTarget(g, now) {
  const t = g.pick(['tomorrow', '2100', 'int', 'big', 'dec', 'small', 'neg']);
  switch (t) {
    case 'tomorrow': { const d = new Date(now); d.setDate(d.getDate() + 1); return Number(ddmmyy(d)); }
    case '2100': return 2100;
    case 'int': return g.int(1, 999999);
    case 'big': return g.int(1000000, 99999999);
    case 'dec': return Number(`${g.int(1, 99999)}.${g.int(1, 99)}`);
    case 'small': return g.int(1, 99);
    default: return -g.int(1, 5000);
  }
}

/**
 * Kører `runs` tilfældige regnestykker mod tilfældige mål.
 * Returnerer statistik; `failures` indeholder eksempler på fejl.
 */
export function runSelfTest({ runs = 2000, seed = 42, now = new Date(2026, 9, 11) } = {}) {
  const rand = rng(seed);
  const g = makeGen(rand);
  const stats = {
    runs, hit: 0, exact: 0, rounded: 0, opSwap: 0, completed: 0, extraIgnored: 0,
    honestFallback: 0, liar: 0, repeatOk: 0, redoOk: 0, honestOk: 0, honestRuns: 0,
    byKind: {}, failures: [],
  };
  for (let i = 0; i < runs; i++) {
    const sc = scenario(g);
    const target = makeTarget(g, now);
    const forcePos = sc.nums.length + 1;
    const calc = new Calculator({
      settings: { enabled: true, targetMode: 'fixed', target: String(target).replace('.', ','), trigger: 'nth', nth: forcePos, uses: 0, lateFix: true, allowSwap: true },
      now: () => now,
    });
    const keys = [];
    sc.nums.forEach((n, j) => {
      keys.push(...typeNumber(n));
      if (j < sc.ops.length) keys.push(sc.ops[j]);
    });
    keys.push(sc.forceOp);
    const typed = g.int(1, 8);
    for (let k = 0; k < typed; k++) keys.push(String(g.int(0, 9)));
    const logsBefore = calc.logs.length;
    calc.pressAll(keys);
    const st = calc.calc.stream;
    const needed = st ? st.plan.units.length : 0;
    calc.press('=');
    const view = calc.getView();
    const shown = view.main.map((p) => p.text).join('');
    const exprVal = evaluate(calc.resultTokens);
    const tol = 1e-6 * Math.max(1, Math.abs(target));
    const want = formatNumber(target);
    const kindStat = (stats.byKind[sc.kind] ||= { runs: 0, hit: 0 });
    kindStat.runs++;
    const newLogs = calc.logs.slice(logsBefore).map((l) => l.msg);
    if (shown === want) {
      stats.hit++;
      kindStat.hit++;
      if (formatNumber(exprVal) === want) stats.exact++;
      else if (Math.abs(exprVal - target) <= tol) stats.rounded++;
      else {
        stats.liar++;
        if (stats.failures.length < 20) stats.failures.push({ type: 'udtryk passer ikke', expr: tokensText(calc.resultTokens), target: want, logs: newLogs });
      }
      if (newLogs.some((m) => m.startsWith('Operator skiftet'))) stats.opSwap++;
      if (st && typed < needed) stats.completed++;
      if (st && typed > needed) stats.extraIgnored++;

      // Gentaget "=" skal opføre sig som en almindelig lommeregner
      const rep = calc.repeat;
      calc.press('=');
      const again = parseDisplay(calc.getView().main[0].text);
      const expected = rep ? evaluate([{ t: 'n', fixed: target }, { t: 'o', op: rep.op }, { t: 'n', fixed: rep.operand }]) : target;
      if (formatNumber(again) === formatNumber(expected) || calc.getView().main[0].text === formatNumber(expected)) stats.repeatOk++;
      else if (stats.failures.length < 20) stats.failures.push({ type: 'gentaget = afviger', expr: tokensText(calc.resultTokens), got: calc.getView().main[0].text, want: formatNumber(expected) });

      // Samme regnestykke tastet igen (nye tilfældige cifre) skal give samme mål
      calc.press('clear');
      calc.pressAll(keys.slice(0, keys.length - typed));
      for (let k = 0; k < g.int(1, 8); k++) calc.press(String(g.int(0, 9)));
      calc.press('=');
      if (calc.getView().main.map((p) => p.text).join('') === want) stats.redoOk++;
      else if (stats.failures.length < 20) stats.failures.push({ type: 'gentagelse ramte ikke', expr: tokensText(calc.resultTokens), target: want });
    } else {
      stats.honestFallback++;
      if (Math.abs(parseDisplay(shown) - exprVal) > 1e-6 * Math.max(1, Math.abs(exprVal)) && shown !== 'Fejl') {
        stats.liar++;
        if (stats.failures.length < 20) stats.failures.push({ type: 'ærligt resultat forkert', expr: tokensText(calc.resultTokens), shown });
      }
      if (stats.failures.length < 20) stats.failures.push({ type: 'ramte ikke (ærligt resultat)', kind: sc.kind, expr: tokensText(calc.resultTokens), shown, target: want, logs: newLogs });
    }
  }

  // Ærlig tilstand: force slået fra skal give korrekte resultater
  const honestRuns = Math.max(200, Math.floor(runs / 4));
  for (let i = 0; i < honestRuns; i++) {
    const sc = scenario(g);
    const calc = new Calculator({ settings: { enabled: false } });
    const keys = [];
    sc.nums.forEach((n, j) => { keys.push(...typeNumber(n)); if (j < sc.ops.length) keys.push(sc.ops[j]); });
    keys.push(sc.forceOp, ...typeNumber(g.any()), '=');
    calc.pressAll(keys);
    const shown = calc.getView().main[0].text;
    const exprVal = evaluate(calc.resultTokens);
    stats.honestRuns++;
    if (shown === formatNumber(exprVal)) stats.honestOk++;
    else if (stats.failures.length < 20) stats.failures.push({ type: 'ærlig tilstand forkert', expr: tokensText(calc.resultTokens), shown, want: formatNumber(exprVal) });
  }
  return stats;
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1).replace('.', ',') : '0') + ' %';

export function formatReport(s) {
  const lines = [
    `Force-motor selvtest – ${s.runs} tilfældige regnestykker`,
    `  Ramte målet ............ ${s.hit} (${pct(s.hit, s.runs)})`,
    `    heraf helt eksakt .... ${s.exact} (${pct(s.exact, s.hit)})`,
    `    heraf afrundet ×/÷ ... ${s.rounded} (${pct(s.rounded, s.hit)})`,
    `    operator skiftet ..... ${s.opSwap} (${pct(s.opSwap, s.hit)})`,
    `    cifre fuldført ved = . ${s.completed}`,
    `    ekstra tryk ignoreret  ${s.extraIgnored}`,
    `  Ærligt resultat (opgav)  ${s.honestFallback}`,
    `  Løgn (mål vist, men udtryk ≠ mål): ${s.liar}`,
    `  Gentaget "=" korrekt ... ${s.repeatOk}/${s.hit}`,
    `  Samme regnestykke igen . ${s.redoOk}/${s.hit}`,
    `  Ærlig tilstand korrekt . ${s.honestOk}/${s.honestRuns}`,
    '  Pr. type:',
    ...Object.entries(s.byKind).map(([k, v]) => `    ${k.padEnd(10)} ${v.hit}/${v.runs}`),
  ];
  if (s.failures.length) {
    lines.push('  Eksempler på afvigelser:');
    for (const f of s.failures.slice(0, 8)) lines.push('    ' + JSON.stringify(f));
  }
  return lines.join('\n');
}
