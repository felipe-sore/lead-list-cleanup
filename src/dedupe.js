'use strict';

const { key, words, isBlank } = require('./text');

const LEGAL_SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'plc', 'gmbh', 'ag',
  'bv', 'sa', 'srl', 'sl', 'sas', 'ltda', 'eireli', 'me', 'epp', 'spa',
]);

// "Acme Inc.", "ACME, Inc" and "acme" are the same company.
function companyKey(row) {
  const name = words(row.Company).split(' ').filter((w) => w && !LEGAL_SUFFIXES.has(w)).join('');
  if (name) return name;
  return row._freeProvider || isBlank(row._domain) ? '' : `domain:${row._domain}`;
}

function removeDuplicates(rows) {
  const kept = [];
  const removed = [];
  const seenEmail = new Set();
  const seenNameCompany = new Set();
  for (const row of rows) {
    const email = row._emailKey;
    const nameCompany = key(row['First Name']) && key(row['Last Name']) && companyKey(row)
      ? `${key(row['First Name'])}|${key(row['Last Name'])}|${companyKey(row)}`
      : '';
    if (email && seenEmail.has(email)) { removed.push({ row, reason: 'duplicate email' }); continue; }
    if (nameCompany && seenNameCompany.has(nameCompany)) { removed.push({ row, reason: 'duplicate name and company' }); continue; }
    if (email) seenEmail.add(email);
    if (nameCompany) seenNameCompany.add(nameCompany);
    kept.push(row);
  }
  return { kept, removed };
}

// Keeps the best contact per company: highest seniority, then a usable email,
// then a valid phone, then the original order.
function onePerCompany(rows) {
  const score = (r) => [
    r._rank,
    ['domain_ok', 'syntax_ok'].includes(r['Email Status']) && !r._generic ? 1 : 0,
    r['Phone Status'] === 'valid' ? 1 : 0,
    -r._index,
  ];
  const better = (a, b) => {
    const sa = score(a); const sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] > sb[i];
    return false;
  };
  const best = new Map();
  for (const row of rows) {
    const k = companyKey(row);
    if (!k) continue;
    if (!best.has(k) || better(row, best.get(k))) best.set(k, row);
  }
  const kept = [];
  const removed = [];
  for (const row of rows) {
    const k = companyKey(row);
    if (!k || best.get(k) === row) kept.push(row);
    else removed.push({ row, reason: 'same company, kept a more senior contact' });
  }
  return { kept, removed };
}

module.exports = { removeDuplicates, onePerCompany, companyKey };
