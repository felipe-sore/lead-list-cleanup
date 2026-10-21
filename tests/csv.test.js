'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, toCsv, detectDelimiter } = require('../src/csv');

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
