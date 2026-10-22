'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, toCsv, detectDelimiter, neutralizeFormula } = require('../src/csv');

test('parses quotes, escaped quotes and newlines inside fields', () => {
  const { headers, rows } = parseCsv('name,note\r\n"Doe, Jane","said ""hi""\nthen left"\r\n');
  assert.deepEqual(headers, ['name', 'note']);
  assert.equal(rows[0].name, 'Doe, Jane');
  assert.equal(rows[0].note, 'said "hi"\nthen left');
});

test('detects semicolon and tab delimiters and strips the BOM', () => {
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a\tb\n1\t2'), '\t');
  const { headers } = parseCsv('﻿Nome;Empresa\nAna;Fabrikam');
  assert.deepEqual(headers, ['Nome', 'Empresa']);
});

test('round-trips through toCsv', () => {
  const rows = [{ a: 'x, y', b: 'say "z"' }];
  const back = parseCsv(toCsv(['a', 'b'], rows)).rows;
  assert.deepEqual(back, rows);
});

test('skips empty lines', () => {
  assert.equal(parseCsv('a,b\n1,2\n\n,\n3,4\n').rows.length, 2);
});

test('cells that would run as a spreadsheet formula are written as text', () => {
  const rows = [{
    company: '=HYPERLINK("https://evil.example","Click")',
    info: '@SUM(1+1)',
    title: '+cmd|calc',
    note: '-2+3',
    tab: '\t=1',
  }];
  const out = parseCsv(toCsv(Object.keys(rows[0]), rows)).rows[0];
  for (const [k, v] of Object.entries(rows[0])) assert.equal(out[k].trimStart().startsWith("'"), true, k);
  assert.equal(out.company, `'${rows[0].company}`);
});

test('phones, negative numbers and normal text are left alone', () => {
  for (const v of ['+5521998765432', '+1 (415) 555-0100', '-12.5', 'Head of Sales', 'jane@fabrikam.example', '']) {
    assert.equal(neutralizeFormula(v), v);
  }
});

test('the guard is idempotent: a cleaned file can be cleaned again', () => {
  const once = parseCsv(toCsv(['a'], [{ a: '=1+1' }])).rows;
  const twice = parseCsv(toCsv(['a'], once)).rows;
  assert.deepEqual(twice, once);
});
