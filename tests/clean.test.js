'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('../src/csv');
const { clean } = require('../src/clean');
const { cfg } = require('./helpers');

const sample = parseCsv(fs.readFileSync(path.join(__dirname, '..', 'examples', 'sample_input.csv'), 'utf8'));
const byEmail = (rows, email) => rows.find((r) => r.Email === email);

test('end to end on the sample list, no network', async () => {
  const out = await clean(sample, cfg, { defaultCountry: 'US' });
  assert.equal(sample.rows.length, 9);
  assert.equal(out.rows.length, 8);
  assert.deepEqual(out.removed.map((r) => r.reason), ['duplicate email']);

  const jane = byEmail(out.rows, 'jane.doe@northwindlabs.example');
  assert.equal(jane['First Name'], 'Jane');
  assert.equal(jane.Segment, 'decision_maker');
  assert.equal(jane.Phone, '+12124567890');

  const maria = byEmail(out.rows, 'maria.silva@fabrikam.example');
  assert.equal(maria['Last Name'], 'Jose da Silva');
  assert.equal(maria.Phone, '+5521998765432');

  const info = byEmail(out.rows, 'info@contoso.example');
  assert.equal(info['Generic Email'], 'true');
  assert.equal(info['First Name'], '');

  const asmith = byEmail(out.rows, 'asmith@globex.example');
  assert.equal(asmith['First Name'], '');
  assert.match(asmith.Notes, /not confirmed/);

  assert.equal(byEmail(out.rows, 'tom@mailinator.com')['Email Status'], 'disposable');
  assert.equal(byEmail(out.rows, 'tom@mailinator.com')['Phone Status'], 'invalid');
  assert.equal(byEmail(out.rows, 'ana.costa@fabrikam')['Email Status'], 'invalid_syntax');
  assert.equal(byEmail(out.rows, 'kim.lee@contoso.example').Segment, 'individual_contributor');

  assert.ok(!out.headers.some((h) => h.startsWith('_')));
  assert.match(out.report, /Contacts in: \*\*9\*\*/);
});

test('one contact per company keeps the most senior one', async () => {
  const out = await clean(sample, cfg, { onePerCompany: true, defaultCountry: 'US' });
  const companies = out.rows.map((r) => r.Company);
  assert.equal(new Set(companies.map((c) => c.toLowerCase().replace(/\W|inc|ltda/g, ''))).size, companies.length);
  assert.ok(byEmail(out.rows, 'jane.doe@northwindlabs.example'));
  assert.ok(!byEmail(out.rows, 'john.smith@northwindlabs.example'));
  assert.ok(byEmail(out.rows, 'maria.silva@fabrikam.example'));
  assert.ok(!byEmail(out.rows, 'ana.costa@fabrikam'));
});

test('Portuguese headers map to the canonical columns', async () => {
  const pt = parseCsv('Nome;Sobrenome;Cargo;Empresa;E-mail;Telefone;País\nJOÃO;DOS SANTOS;Gerente Comercial;Acme;joao@acme.example;(11) 98765-4321;Brasil\n');
  const out = await clean(pt, cfg);
  assert.deepEqual(out.headers.slice(0, 7), ['First Name', 'Last Name', 'Title', 'Company', 'Email', 'Phone', 'Country']);
  assert.equal(out.rows[0]['First Name'], 'João');
  assert.equal(out.rows[0]['Last Name'], 'dos Santos');
  assert.equal(out.rows[0].Phone, '+5511987654321');
  assert.equal(out.rows[0].Segment, 'management');
});

test('unknown columns are kept', async () => {
  const out = await clean(parseCsv('Email,Lead Source\na.b@x.example,Webinar\n'), cfg);
  assert.ok(out.headers.includes('Lead Source'));
  assert.equal(out.rows[0]['Lead Source'], 'Webinar');
});

test('adapters run only when asked, and the WhatsApp check skips invalid phones', async () => {
  const seen = [];
  const adapters = { whatsapp: async (p) => { seen.push(p); return 'on_whatsapp'; }, whatsappDelayMs: 0 };
  await clean(sample, cfg, { defaultCountry: 'US' }, adapters);
  assert.equal(seen.length, 0);
  const out = await clean(sample, cfg, { defaultCountry: 'US', checkWhatsapp: true }, adapters);
  assert.ok(seen.length > 0 && seen.every((p) => p.startsWith('+')));
  assert.equal(byEmail(out.rows, 'tom@mailinator.com').WhatsApp, 'not_checked');
});
