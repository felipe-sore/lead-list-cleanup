'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeEmail, checkMailServers } = require('../src/email');
const { cfg } = require('./helpers');

test('normalizes and flags generic, disposable and free addresses', () => {
  const a = analyzeEmail('  INFO@Acme.com ', cfg);
  assert.equal(a.email, 'info@acme.com');
  assert.equal(a.generic, true);
  assert.equal(analyzeEmail('x@mailinator.com', cfg).status, 'disposable');
  assert.equal(analyzeEmail('jane@gmail.com', cfg).free, true);
});

test('rejects bad syntax', () => {
  for (const bad of ['ana@fabrikam', 'ana..b@x.com', '@x.com', 'a b@x.com', 'ana@-x.com']) {
    assert.equal(analyzeEmail(bad, cfg).status, 'invalid_syntax', bad);
  }
});

test('MX check: one lookup per domain, A record fallback, no mail server', async () => {
  const calls = [];
  const resolver = {
    resolveMx: async (d) => {
      calls.push(d);
      if (d === 'mx.example') return [{ exchange: 'mail.mx.example', priority: 10 }];
      const e = new Error('no data'); e.code = 'ENODATA'; throw e;
    },
    resolve4: async (d) => {
      if (d === 'a-only.example') return ['192.0.2.1'];
      const e = new Error('not found'); e.code = 'ENOTFOUND'; throw e;
    },
  };
  const out = await checkMailServers(['mx.example', 'mx.example', 'a-only.example', 'dead.example'], resolver);
  assert.equal(out.get('mx.example'), 'domain_ok');
  assert.equal(out.get('a-only.example'), 'domain_ok');
  assert.equal(out.get('dead.example'), 'no_mail_server');
  assert.equal(calls.filter((d) => d === 'mx.example').length, 1);
});
