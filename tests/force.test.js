import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../src/calculator.js';
import { planForce, evaluate } from '../src/force.js';
import { runSelfTest, formatReport } from '../src/selftest.js';

const keys = (s) => s.split('');
const main = (c) => c.getView().main.map((p) => p.text).join('');
const expr = (c) => (c.getView().expr || []).map((p) => p.text).join('');
const NOW = new Date(2026, 9, 11); // 11. okt 2026 -> i morgen = 121026
const force = (s = {}) => new Calculator({ settings: { enabled: true, uses: 0, ...s }, now: () => NOW });

test('fødselsdato + postnummer + tilfældigt tal = i morgens dato', () => {
  const c = force({ targetMode: 'tomorrow', nth: 3 });
  c.pressAll([...keys('240387+2100+'), ...keys('987654'), '=']);
  assert.equal(main(c), '121.026');
  assert.equal(evaluate(c.resultTokens), 121026);
  assert.match(c.logs.map((l) => l.msg).join('\n'), /Operator skiftet/); // mål < sum → + bliver −
});

test('talstrøm: hvert tryk viser næste beregnede ciffer', () => {
  const c = force({ target: '5000', nth: 2 });
  c.pressAll(keys('2100+'));
  c.press('7');
  assert.equal(main(c), '2.100+2');
  c.pressAll(keys('11'));
  assert.equal(main(c), '2.100+290');
  c.press('back');
  assert.equal(main(c), '2.100+29');
  c.pressAll(keys('555'));
  assert.equal(main(c), '2.100+2.900'); // ekstra tryk ignoreres
  c.press('=');
  assert.equal(main(c), '5.000');
  assert.equal(expr(c), '2.100+2.900');
});

test('færre tryk end nødvendigt: tallet fuldføres ved =', () => {
  const c = force({ target: '99999', nth: 2 });
  c.pressAll([...keys('12+3'), '=']);
  assert.equal(main(c), '99.999');
  assert.equal(expr(c), '12+99.987');
});

test('Netto-kvittering med decimaler', () => {
  const c = force({ target: '500', nth: 4 });
  c.pressAll([...keys('147,95+23,5+89,25+'), ...keys('1111'), '=']);
  assert.equal(main(c), '500');
  assert.equal(expr(c), '147,95+23,5+89,25+239,3');
});

test('Lotto-række (7 af 36) lagt sammen', () => {
  const c = force({ target: '2100', nth: 8 });
  c.pressAll([...keys('3+7+12+18+22+30+35+'), ...keys('4'), '=']);
  assert.equal(main(c), '2.100');
  assert.equal(evaluate(c.resultTokens), 2100);
});

test('× og ÷ med afrunding viser stadig målet', () => {
  let c = force({ target: '2100', nth: 2 });
  c.pressAll([...keys('240387÷'), ...keys('123'), '=']);
  assert.equal(main(c), '2.100');
  c = force({ target: '2100', nth: 2, allowSwap: false });
  c.pressAll([...keys('240387×'), ...keys('5'), '=']);
  assert.equal(main(c), '2.100');
  assert.ok(Math.abs(evaluate(c.resultTokens) - 2100) < 0.01);
});

test('gentaget = opfører sig som almindelig lommeregner', () => {
  const c = force({ target: '5000', nth: 2 });
  c.pressAll([...keys('2100+1'), '=', '=']);
  assert.equal(main(c), '7.900');
});

test('gentagelse: samme regnestykke igen giver samme tal, også efter brugt op', () => {
  const c = force({ target: '5000', nth: 2, uses: 1 });
  c.pressAll([...keys('2100+7'), '=']);
  assert.equal(main(c), '5.000');
  c.pressAll(['clear', ...keys('2100+3'), '=']);
  assert.equal(main(c), '5.000');
  assert.equal(expr(c), '2.100+2.900');
  c.pressAll(['clear', ...keys('2200+3'), '=']); // andet regnestykke: ærligt
  assert.equal(main(c), '2.203');
});

test('rettet tal og gentaget mens force er aktiv rammer igen', () => {
  const c = force({ target: '5000', nth: 2, uses: 3 });
  c.pressAll([...keys('2100+7'), '=']);
  c.pressAll(['clear', ...keys('2150+7'), '=']);
  assert.equal(main(c), '5.000');
  assert.equal(expr(c), '2.150+2.850');
});

test('panik gør lommeregneren ærlig', () => {
  const c = force({ target: '5000', nth: 2 });
  c.pressAll(keys('2100+'));
  c.press('1');
  c.panic();
  c.pressAll(['clear', ...keys('2100+1'), '=']);
  assert.equal(main(c), '2.101');
  assert.equal(c.settings.enabled, false);
});

test('force slået fra: helt almindelig', () => {
  const c = new Calculator();
  c.pressAll([...keys('2100+1'), '=']);
  assert.equal(main(c), '2.101');
});

test('ret sidste tal ved = når tilskueren taster færre tal end N', () => {
  const c = force({ target: '5000', nth: 3 });
  c.pressAll([...keys('2100+10'), '=']);
  assert.equal(main(c), '5.000');
  assert.equal(expr(c), '2.100+2.900');
});

test('første tal efter = (fortsat regning)', () => {
  const c = force({ target: '2100', trigger: 'afterEquals' });
  c.pressAll([...keys('240387+1'), '=']);
  assert.equal(main(c), '240.388');
  c.pressAll(['-', ...keys('9'), '=']);
  assert.equal(main(c), '2.100');
});

test('manuel trigger', () => {
  const c = force({ target: '2100', trigger: 'manual' });
  c.pressAll([...keys('5+5'), '=']);
  assert.equal(main(c), '10');
  c.armManual();
  c.pressAll(['clear', ...keys('5+5'), '=']);
  assert.equal(main(c), '2.100');
});

test('planner vælger mest troværdige løsning', () => {
  const p = planForce({ prefix: [{ t: 'n', text: '240387' }], op: '+', target: 121026 });
  assert.equal(p.op, '-');
  assert.equal(p.text, '119361');
  const q = planForce({ prefix: [{ t: 'n', text: '100' }], op: '+', target: 100, allowSwap: false });
  assert.equal(q.ok, true);
  assert.ok(q.score >= 500); // 0 er mistænkeligt
});

test('randomiseret: 20.000 regnestykker mod mange mål', () => {
  const s = runSelfTest({ runs: 20000, seed: 2026 });
  console.log(formatReport(s));
  assert.equal(s.liar, 0, 'målet må aldrig vises med et udtryk der ikke passer');
  assert.ok(s.hit / s.runs > 0.98, 'mindst 98 % rammer');
  assert.equal(s.repeatOk, s.hit);
  assert.equal(s.redoOk, s.hit);
  assert.equal(s.honestOk, s.honestRuns);
});
