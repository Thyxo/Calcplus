import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../src/calculator.js';
import { formatNumber, formatInput, parseDisplay } from '../src/format.js';

const run = (seq, settings) => new Calculator({ settings }).pressAll(seq);
const main = (c) => c.getView().main.map((p) => p.text).join('');
const expr = (c) => (c.getView().expr || []).map((p) => p.text).join('');
const keys = (s) => s.split('');

test('dansk formatering', () => {
  assert.equal(formatNumber(1234567.89), '1.234.567,89');
  assert.equal(formatNumber(-366210), '-366.210');
  assert.equal(formatNumber(0.1 + 0.2), '0,3');
  assert.equal(formatNumber(1e20), '1e20');
  assert.equal(formatNumber(1 / 0), 'Fejl');
  assert.equal(formatInput('5634,', false), '5.634,');
  assert.equal(parseDisplay('1.234,5'), 1234.5);
  assert.equal(parseDisplay('2.100'), 2100);
});

test('regnehierarki og gentaget =', () => {
  const c = run(keys('2+3×4='));
  assert.equal(main(c), '14');
  assert.equal(expr(c), '2+3×4');
  c.press('=');
  assert.equal(main(c), '56');
});

test('procent som på iPhone', () => {
  assert.equal(main(run([...keys('200+10'), 'pct', '='])), '220');
  assert.equal(main(run([...keys('200×10'), 'pct', '='])), '20');
  assert.equal(main(run([...keys('50'), 'pct', '='])), '0,5');
});

test('±, komma og visning af negative tal i parentes', () => {
  const c = run([...keys('5634,'), 'pm', '×', '6', '5']);
  assert.equal(main(c), '(-5.634,)×65');
  c.press('=');
  assert.equal(main(c), '-366.210');
});

test('AC/C-skift og slet', () => {
  const c = new Calculator();
  assert.equal(c.getView().clearLabel, 'AC');
  c.pressAll(keys('123'));
  assert.equal(c.getView().clearLabel, 'C');
  c.press('back');
  assert.equal(main(c), '12');
  c.press('clear');
  assert.equal(c.getView().clearLabel, 'AC');
  assert.equal(main(c), '0');
});

test('lange tal (op til 16 cifre) og eksponent ved store tal', () => {
  assert.equal(main(run(keys('1234567890123'))), '1.234.567.890.123');
  assert.equal(main(run(keys('12345678901234567890'))), '1.234.567.890.123.456');
  const c = run(keys('99999999×99999999=×99999999='));
  assert.match(main(c), /e23$/);
});

test('division med 0 giver Fejl', () => {
  assert.equal(main(run(keys('7÷0='))), 'Fejl');
});

test('fortsat regning efter =', () => {
  const c = run(keys('10+5=×2='));
  assert.equal(main(c), '30');
});
