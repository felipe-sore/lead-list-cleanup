'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fixCase, splitFullName, nameFromEmail } = require('../src/names');
const { cfg } = require('./helpers');

test('fixes all-caps and all-lowercase names, keeps particles lowercase', () => {
  assert.equal(fixCase('MARIA JOSE DA SILVA', cfg.particles), 'Maria Jose da Silva');
  assert.equal(fixCase('ludwig van beethoven', cfg.particles), 'Ludwig van Beethoven');
  assert.equal(fixCase("SEAN O'BRIEN", cfg.particles), "Sean O'Brien");
  assert.equal(fixCase('JEAN-LUC PICARD', cfg.particles), 'Jean-Luc Picard');
});

test('keeps intentional mixed case', () => {
  assert.equal(fixCase('Ronald McDonald', cfg.particles), 'Ronald McDonald');
});

test('splits a full name', () => {
  assert.deepEqual(splitFullName('JANE DOE SMITH', cfg.particles), { first: 'Jane', last: 'Doe Smith' });
});

test('name from email: first.last pattern is reliable', () => {
  assert.deepEqual(nameFromEmail('anna.smith@acme.com', cfg), { first: 'Anna', last: 'Smith', confidence: 'pattern' });
});

test('name from email: single token only becomes a suggestion, never a name', () => {
  const guess = nameFromEmail('asmith@acme.com', cfg);
  assert.equal(guess.confidence, 'suggestion');
  assert.equal(guess.first, '');
  assert.match(guess.note, /Smith/);
});

test('name from email: single token confirmed by the first-name list', () => {
  const local = { ...cfg, firstNames: new Set(['guilherme']) };
  assert.deepEqual(nameFromEmail('guilherme@acme.com', local), { first: 'Guilherme', last: '', confidence: 'first_name_list' });
});

test('name from email: generic mailboxes are ignored', () => {
  assert.equal(nameFromEmail('info@acme.com', cfg), null);
});

test('name from email: a role word anywhere means no name is taken', () => {
  for (const e of ['sales.team@acme.com', 'contact-us@acme.com', 'support_latam@acme.com', 'jane.support@acme.com', 'info+promo@acme.com']) {
    assert.equal(nameFromEmail(e, cfg), null, e);
  }
  assert.deepEqual(nameFromEmail('jane.doe@acme.com', cfg), { first: 'Jane', last: 'Doe', confidence: 'pattern' });
});
