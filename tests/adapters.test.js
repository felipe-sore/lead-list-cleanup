'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const emailVerifier = require('../src/adapters/email-verifier');
const whatsapp = require('../src/adapters/whatsapp');
const { extract } = require('../src/adapters/website');

function mockFetch(responder) {
  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    const body = responder(url, init);
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
  return calls;
}

test('generic HTTP email verifier reads the configured field and sends the header', async () => {
  const calls = mockFetch(() => ({ result: { state: 'deliverable' } }));
  const env = {
    EMAIL_VERIFIER: 'http',
    EMAIL_VERIFIER_URL: 'https://verify.example/check?email={email}',
    EMAIL_VERIFIER_HEADER: 'X-Api-Key: secret',
    EMAIL_VERIFIER_FIELD: 'result.state',
  };
  assert.equal(emailVerifier.configured(env), true);
  assert.equal(await emailVerifier.verifyEmail('a+b@x.com', env), 'deliverable');
  assert.equal(calls[0].url, 'https://verify.example/check?email=a%2Bb%40x.com');
  assert.equal(calls[0].init.headers['X-Api-Key'], 'secret');
});

test('Reacher adapter posts to /v0/check_email', async () => {
  const calls = mockFetch(() => ({ is_reachable: 'safe' }));
  const env = { EMAIL_VERIFIER: 'reacher', REACHER_URL: 'http://localhost:8080/' };
  assert.equal(await emailVerifier.verifyEmail('a@x.com', env), 'safe');
  assert.equal(calls[0].url, 'http://localhost:8080/v0/check_email');
  assert.equal(JSON.parse(calls[0].init.body).to_email, 'a@x.com');
});

test('nothing configured means the adapter is off', () => {
  assert.equal(emailVerifier.configured({}), false);
  assert.equal(whatsapp.configured({}), false);
});

test('WhatsApp adapter maps the boolean field', async () => {
  mockFetch((url) => ({ data: { numberExists: url.includes('5521') } }));
  const env = { WHATSAPP_CHECK_URL: 'https://gw.example/check?phone={phone}', WHATSAPP_CHECK_FIELD: 'data.numberExists' };
  assert.equal(await whatsapp.hasWhatsApp('+5521998765432', env), 'on_whatsapp');
  assert.equal(await whatsapp.hasWhatsApp('+12124567890', env), 'not_on_whatsapp');
});

test('website metadata extraction', () => {
  const html = '<html><head><title> Fabrikam | Industrial IoT </title><meta name="description" content="Sensors for factories."></head></html>';
  assert.equal(extract(html), 'Fabrikam | Industrial IoT | Sensors for factories.');
});
