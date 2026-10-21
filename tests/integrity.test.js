'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkCrossContamination, slugOf } = require('../src/integrity');
const { cfg } = require('./helpers');

const row = (first, last, company, url, title) => ({
  'First Name': first, 'Last Name': last, Company: company,
  'LinkedIn URL': url, 'LinkedIn Status': 'confirmed',
  'Enriched Title': title, 'Enriched Title Status': 'confirmed',
});

test('slug is extracted and normalized', () => {
  assert.equal(slugOf('https://www.linkedin.com/in/Marília-Diniz-12ab/?x=1'), 'mariliadiniz12ab');
});

test('a URL shared by two contacts stays only with its owner', () => {
  const owner = row('Marilia', 'Diniz', 'Globex', 'https://linkedin.com/in/marilia-diniz', 'Head of Sales at Globex');
  const wrong = row('Marcelo', 'Franco', 'Initech', 'https://www.linkedin.com/in/marilia-diniz/', 'Head of Sales at Globex');
  const changes = checkCrossContamination([owner, wrong], cfg.particles);
  assert.equal(owner['LinkedIn URL'], 'https://linkedin.com/in/marilia-diniz');
  assert.equal(wrong['LinkedIn URL'], '');
  assert.equal(wrong['LinkedIn Status'], 'not_found');
  assert.equal(wrong['Enriched Title'], '');
  assert.ok(changes.length >= 2);
});

test('owner keeps the URL but loses a title from another company', () => {
  const owner = row('Ana', 'Costa', 'Fabrikam', 'https://linkedin.com/in/ana-costa', 'CMO at Contoso');
  const wrong = row('Rui', 'Lopes', 'Contoso', 'https://linkedin.com/in/ana-costa', 'CMO at Contoso');
  checkCrossContamination([owner, wrong], cfg.particles);
  assert.equal(owner['LinkedIn URL'], 'https://linkedin.com/in/ana-costa');
  assert.equal(owner['Enriched Title'], '');
  assert.equal(owner['Enriched Title Status'], 'not_found');
});

test('when nobody matches the URL, both are downgraded', () => {
  const a = row('Ana', 'Costa', 'Fabrikam', 'https://linkedin.com/in/john-roe', '');
  const b = row('Rui', 'Lopes', 'Contoso', 'https://linkedin.com/in/john-roe', '');
  checkCrossContamination([a, b], cfg.particles);
  assert.equal(a['LinkedIn Status'], 'not_found');
  assert.equal(b['LinkedIn Status'], 'not_found');
});

test('unique URLs are left alone', () => {
  const a = row('Ana', 'Costa', 'Fabrikam', 'https://linkedin.com/in/ana-costa', 'CMO at Fabrikam');
  assert.equal(checkCrossContamination([a], cfg.particles).length, 0);
});
