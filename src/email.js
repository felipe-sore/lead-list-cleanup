'use strict';

const dns = require('dns').promises;
const { isBlank } = require('./text');

const SYNTAX = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// Offline checks, no API key needed: syntax, generic mailbox, disposable domain,
// free provider. Lists come from config/ so they can be tuned per market.
function analyzeEmail(raw, cfg) {
  if (isBlank(raw)) return { email: '', status: 'missing', domain: '', generic: false, disposable: false, free: false };
  const email = String(raw).trim().toLowerCase().replace(/^mailto:/, '');
  const valid = SYNTAX.test(email);
  const [local, domain = ''] = email.split('@');
  const result = {
    email,
    domain: valid ? domain : '',
    generic: valid && cfg.rolePrefixes.has(local.replace(/\+.*$/, '')),
    disposable: valid && cfg.disposableDomains.has(domain),
    free: valid && cfg.freeProviders.has(domain),
  };
  result.status = !valid ? 'invalid_syntax' : result.disposable ? 'disposable' : 'syntax_ok';
  return result;
}

// Does the domain accept mail at all? One DNS lookup per unique domain.
// A domain with no MX but with an A record can still receive mail (RFC 5321),
// so only "no MX and no A" counts as no_mail_server.
async function checkMailServers(domains, resolver = dns) {
  const out = new Map();
  for (const domain of new Set(domains)) {
    try {
      const mx = await resolver.resolveMx(domain);
      if (mx && mx.length) { out.set(domain, 'domain_ok'); continue; }
    } catch (err) {
      if (!['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes(err.code)) { out.set(domain, 'dns_error'); continue; }
    }
    try {
      const a = await resolver.resolve4(domain);
      out.set(domain, a && a.length ? 'domain_ok' : 'no_mail_server');
    } catch {
      out.set(domain, 'no_mail_server');
    }
  }
  return out;
}

module.exports = { analyzeEmail, checkMailServers };
