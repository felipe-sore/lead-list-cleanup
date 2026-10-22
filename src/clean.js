'use strict';

const { mapHeaders, remapRow } = require('./columns');
const { fillNames } = require('./names');
const { analyzeEmail, checkMailServers } = require('./email');
const { normalizePhone } = require('./phone');
const { classifyTitle } = require('./seniority');
const { removeDuplicates, onePerCompany } = require('./dedupe');
const { checkCrossContamination } = require('./integrity');
const { buildReport } = require('./report');
const { sleep } = require('./adapters/http');

const CANONICAL_ORDER = [
  'First Name', 'Last Name', 'Full Name', 'Title', 'Company', 'Email', 'Phone',
  'Industry', 'Location', 'Country', 'Company Size', 'Website', 'LinkedIn URL',
];
const ADDED = [
  'Segment', 'Email Domain', 'Email Status', 'Generic Email', 'Disposable Email', 'Free Provider',
  'Phone Status', 'Email Verification', 'WhatsApp', 'Company Info', 'Website Status',
  'LinkedIn Status', 'Enriched Title', 'Enriched Title Status', 'Notes',
];

function prepareRow(raw, index, cfg, options) {
  const row = { ...raw };
  const notes = row.Notes ? [row.Notes] : [];

  const em = analyzeEmail(row.Email, cfg);
  row.Email = em.email;
  row['Email Domain'] = em.domain;
  row['Email Status'] = em.status;
  row['Generic Email'] = String(em.generic);
  row['Disposable Email'] = String(em.disposable);
  row['Free Provider'] = String(em.free);

  notes.push(...fillNames(row, cfg));

  const ph = normalizePhone(row.Phone, { country: row.Country, defaultCountry: options.defaultCountry });
  row.Phone = ph.phone;
  row['Phone Status'] = ph.status;
  if (ph.note) notes.push(ph.note);

  const seniority = classifyTitle(row.Title, cfg.seniority);
  row.Segment = seniority.segment;
  row.Notes = notes.filter(Boolean).join('; ');

  // Internal fields, stripped before writing.
  Object.assign(row, {
    _index: index, _rank: seniority.rank, _emailKey: em.status === 'invalid_syntax' ? '' : em.email,
    _domain: em.domain, _freeProvider: em.free, _generic: em.generic,
  });
  return row;
}

async function runAdapters(rows, adapters, options, log) {
  if (options.verifyEmail && adapters.emailVerifier) {
    for (const row of rows) {
      if (!['syntax_ok', 'domain_ok'].includes(row['Email Status'])) continue;
      try { row['Email Verification'] = await adapters.emailVerifier(row.Email); }
      catch (err) { row['Email Verification'] = 'error'; log(`email verification failed for ${row.Email}: ${err.message}`); }
    }
  }
  if (options.checkWhatsapp && adapters.whatsapp) {
    let first = true;
    for (const row of rows) {
      if (row['Phone Status'] !== 'valid') { row.WhatsApp = 'not_checked'; continue; }
      if (!first) await sleep(adapters.whatsappDelayMs || 0);
      first = false;
      try { row.WhatsApp = await adapters.whatsapp(row.Phone); }
      catch (err) { row.WhatsApp = 'error'; log(`WhatsApp check failed: ${err.message}`); }
    }
  }
  if (options.scrape && adapters.website) {
    const domains = [...new Set(rows.filter((r) => r._domain && !r._freeProvider).map((r) => r._domain))];
    const results = new Map();
    for (const d of domains) results.set(d, await adapters.website(d));
    for (const row of rows) {
      const r = results.get(row._domain);
      if (!r) continue;
      row['Company Info'] = r.info;
      row['Website Status'] = r.status;
    }
  }
}

/**
 * Cleans a parsed CSV.
 * options: { onePerCompany, defaultCountry, checkMx, verifyEmail, checkWhatsapp, scrape }
 * adapters: injected provider functions, so tests never touch the network.
 */
async function clean({ headers, rows }, cfg, options = {}, adapters = {}, log = () => {}) {
  const { mapping, extra } = mapHeaders(headers, cfg.headers, ADDED.filter((h) => h !== 'Notes'));
  let working = rows.map((r, i) => prepareRow(remapRow(r, mapping), i, cfg, options));
  const removed = [];

  let step = removeDuplicates(working);
  working = step.kept; removed.push(...step.removed);

  if (options.checkMx) {
    const status = await checkMailServers(working.filter((r) => r['Email Status'] === 'syntax_ok').map((r) => r._domain), adapters.resolver);
    for (const r of working) if (r['Email Status'] === 'syntax_ok') r['Email Status'] = status.get(r._domain) || 'syntax_ok';
  }

  if (options.onePerCompany) {
    step = onePerCompany(working);
    working = step.kept; removed.push(...step.removed);
  }

  await runAdapters(working, adapters, options, log);
  const integrity = checkCrossContamination(working, cfg.particles);

  const present = new Set(working.flatMap((r) => Object.keys(r)));
  const outHeaders = [
    ...CANONICAL_ORDER.filter((h) => present.has(h)),
    ...ADDED.filter((h) => working.some((r) => r[h] !== undefined && r[h] !== '')),
    ...extra.filter((h) => !CANONICAL_ORDER.includes(h) && !ADDED.includes(h)),
  ];
  const outRows = working.map((r) => Object.fromEntries(outHeaders.map((h) => [h, r[h] === undefined ? '' : r[h]])));

  const report = buildReport({ inputCount: rows.length, rows: outRows, removed, integrity, options });
  return { headers: outHeaders, rows: outRows, removed, integrity, report };
}

module.exports = { clean };
