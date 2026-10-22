import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSnapPoints } from '../src/utils.js';

test('parses a single snap point', () => {
  assert.deepEqual(parseSnapPoints('half:0.5'), [{ name: 'half', fraction: 0.5 }]);
});

test('parses multiple snap points and sorts by fraction', () => {
  assert.deepEqual(parseSnapPoints('full:1, quarter:0.25, half:0.5'), [
    { name: 'quarter', fraction: 0.25 },
    { name: 'half', fraction: 0.5 },
    { name: 'full', fraction: 1 },
  ]);
});

test('trims whitespace around entries and names', () => {
  assert.deepEqual(parseSnapPoints(' half : 0.5 , full : 1 '), [
    { name: 'half', fraction: 0.5 },
    { name: 'full', fraction: 1 },
  ]);
});

test('ignores empty entries', () => {
  assert.deepEqual(parseSnapPoints('half:0.5,,full:1,'), [
    { name: 'half', fraction: 0.5 },
    { name: 'full', fraction: 1 },
  ]);
});

test('returns an empty array for missing or empty input', () => {
  assert.deepEqual(parseSnapPoints(undefined), []);
  assert.deepEqual(parseSnapPoints(null), []);
  assert.deepEqual(parseSnapPoints(''), []);
  assert.deepEqual(parseSnapPoints('   '), []);
});

test('throws when the name is missing', () => {
  assert.throws(() => parseSnapPoints(':0.5'), { name: 'TypeError' });
});

test('throws when the separator is missing', () => {
  assert.throws(() => parseSnapPoints('half'), {
    name: 'TypeError',
    message: /Expected name:fraction/,
  });
});

test('throws when the fraction is not a number', () => {
  for (const input of ['half:abc', 'half:NaN', 'half:Infinity']) {
    assert.throws(() => parseSnapPoints(input), { name: 'TypeError' });
  }
});

test('throws when the fraction is zero or negative', () => {
  for (const input of ['half:0', 'half:-0.5']) {
    assert.throws(() => parseSnapPoints(input), { name: 'TypeError' });
  }
});

test('throws when the fraction exceeds one', () => {
  assert.throws(() => parseSnapPoints('full:1.1'), { name: 'TypeError' });
});

test('accepts fractions at the upper boundary', () => {
  assert.deepEqual(parseSnapPoints('full:1'), [{ name: 'full', fraction: 1 }]);
});

test('throws when snap point names are duplicated', () => {
  assert.throws(() => parseSnapPoints('half:0.5,half:0.75'), {
    name: 'TypeError',
    message: 'Duplicate snap point "half".',
  });
});

test('duplicate detection is case-sensitive', () => {
  assert.deepEqual(parseSnapPoints('Half:0.5,half:0.75'), [
    { name: 'Half', fraction: 0.5 },
    { name: 'half', fraction: 0.75 },
  ]);
});
