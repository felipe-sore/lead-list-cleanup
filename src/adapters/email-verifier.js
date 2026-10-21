'use strict';

const { headerFromEnv, pick, getJson } = require('./http');

// Mailbox-level verification ("does this inbox exist?") needs an SMTP conversation,
// which the offline checks cannot do. Bring your own provider:
//
//   EMAIL_VERIFIER=reacher   self-hosted Reacher (check-if-email-exists)
//     REACHER_URL            e.g. http://localhost:8080
//     REACHER_HEADER         optional, "Authorization: <token>"
//
//   EMAIL_VERIFIER=http      any verification API that answers JSON to a GET
//     EMAIL_VERIFIER_URL     URL with {email}, e.g. https://api.example.com/verify?email={email}
//     EMAIL_VERIFIER_HEADER  optional auth header, "Name: value"
//     EMAIL_VERIFIER_FIELD   dotted path to the result in the JSON, e.g. state
//
// Keys live in environment variables only, never in this repository.

function configured(env = process.env) {
  return ['reacher', 'http'].includes(env.EMAIL_VERIFIER);
}

async function verifyEmail(email, env = process.env) {
  if (env.EMAIL_VERIFIER === 'reacher') {
    const data = await getJson(`${env.REACHER_URL.replace(/\/+$/, '')}/v0/check_email`, {
      method: 'POST', body: { to_email: email }, headers: headerFromEnv(env.REACHER_HEADER),
    });
    return String(data.is_reachable || 'unknown');
  }
  if (env.EMAIL_VERIFIER === 'http') {
    const url = env.EMAIL_VERIFIER_URL.replace('{email}', encodeURIComponent(email));
    const data = await getJson(url, { headers: headerFromEnv(env.EMAIL_VERIFIER_HEADER) });
    const value = pick(data, env.EMAIL_VERIFIER_FIELD || 'state');
    return value === undefined ? 'unknown' : String(value);
  }
  throw new Error('No email verifier configured (set EMAIL_VERIFIER)');
}

module.exports = { configured, verifyEmail };
