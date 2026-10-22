'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, countryCode } = require('../src/phone');

test('country names in English, Portuguese and Spanish map to ISO codes', () => {
  assert.equal(countryCode('Brasil'), 'BR');
  assert.equal(countryCode('Brazil'), 'BR');
  assert.equal(countryCode('United States'), 'US');
  assert.equal(countryCode('USA'), 'US');
  assert.equal(countryCode('de'), 'DE');
});

test('formats to E.164 using the row country', () => {
  assert.deepEqual(normalizePhone('(21) 99876-5432', { country: 'Brasil' }), { phone: '+5521998765432', status: 'valid', country: 'BR' });
  assert.equal(normalizePhone('(212) 456-7890', { country: 'US' }).phone, '+12124567890');
});

test('uses the default country when the row has none', () => {
  assert.equal(normalizePhone('212 456 7890', { defaultCountry: 'us' }).phone, '+12124567890');
});

test('handles 00 prefix and a country code that lost its plus sign', () => {
  assert.equal(normalizePhone('0055 21 99876 5432').phone, '+5521998765432');
  const r = normalizePhone('5521998765432');
  assert.equal(r.phone, '+5521998765432');
  assert.match(r.note, /inferred/);
});

test('never drops an invalid number', () => {
  assert.deepEqual(normalizePhone('123', { country: 'US' }), { phone: '123', status: 'invalid' });
  assert.deepEqual(normalizePhone(''), { phone: '', status: 'missing' });
});

test('UK and lower-case codes resolve; an unknown two-letter value is not a country', () => {
  assert.equal(countryCode('UK'), 'GB');
  assert.equal(countryCode('gb'), 'GB');
  assert.equal(countryCode('XX'), null);
  assert.equal(normalizePhone('020 7946 0958', { country: 'UK' }).status, 'valid');
  assert.equal(normalizePhone('020 7946 0958', { defaultCountry: 'United Kingdom' }).phone, '+442079460958');
});
