#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseCsv, toCsv } = require('../src/csv');
const { loadConfig } = require('../src/config');
const { clean } = require('../src/clean');
const emailVerifier = require('../src/adapters/email-verifier');
const whatsapp = require('../src/adapters/whatsapp');
const website = require('../src/adapters/website');

const HELP = `Usage: lead-clean <input.csv> [options]

  --out <file>             output CSV (default: <input>_clean.csv)
  --report <file>          report in Markdown (default: <input>_report.md)
  --one-per-company        keep only the most senior contact per company
  --default-country <XX>   ISO country for phones without country code (e.g. US, BR)
  --split-segments         also write one CSV per segment
  --check-mx               DNS check that each email domain accepts mail (no API key)
  --verify-email           mailbox verification through your provider (EMAIL_VERIFIER)
  --check-whatsapp         WhatsApp lookup through your gateway (WHATSAPP_CHECK_URL)
  --scrape                 company title and description from each company domain
  --integrity-only         only run the LinkedIn/title cross-contamination check
`;

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { opts._.push(a); continue; }
    const name = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (['out', 'report', 'defaultCountry'].includes(name)) opts[name] = argv[++i];
    else opts[name] = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const input = opts._[0];
  if (!input || opts.help) { process.stdout.write(HELP); process.exit(input ? 0 : 1); }

  const base = input.replace(/\.csv$/i, '');
  const outFile = opts.out || `${base}_clean.csv`;
  const reportFile = opts.report || `${base}_report.md`;
  const cfg = loadConfig();
  const parsed = parseCsv(fs.readFileSync(input, 'utf8'));

  if (opts.verifyEmail && !emailVerifier.configured()) throw new Error('--verify-email needs EMAIL_VERIFIER (see README, "Providers")');
  if (opts.checkWhatsapp && !whatsapp.configured()) throw new Error('--check-whatsapp needs WHATSAPP_CHECK_URL (see README, "Providers")');

  const options = opts.integrityOnly ? {} : {
    onePerCompany: Boolean(opts.onePerCompany),
    defaultCountry: opts.defaultCountry,
    checkMx: Boolean(opts.checkMx),
    verifyEmail: Boolean(opts.verifyEmail),
    checkWhatsapp: Boolean(opts.checkWhatsapp),
    scrape: Boolean(opts.scrape),
  };
  const adapters = {
    emailVerifier: (e) => emailVerifier.verifyEmail(e),
    whatsapp: (p) => whatsapp.hasWhatsApp(p),
    whatsappDelayMs: whatsapp.delayMs(),
    website: (d) => website.describeDomain(d),
  };

  let result;
  if (opts.integrityOnly) {
    const { checkCrossContamination } = require('../src/integrity');
    const integrity = checkCrossContamination(parsed.rows, cfg.particles);
    result = { headers: parsed.headers, rows: parsed.rows, report: `# Integrity check\n\n${integrity.length} value(s) cleared.\n\n${integrity.map((c) => `- ${c.name}: ${c.field} "${c.was}" (${c.why})`).join('\n')}\n` };
  } else {
    result = await clean(parsed, cfg, options, adapters, (m) => process.stderr.write(m + '\n'));
  }

  fs.writeFileSync(outFile, toCsv(result.headers, result.rows));
  fs.writeFileSync(reportFile, result.report);

  if (opts.splitSegments && result.rows.length && result.headers.includes('Segment')) {
    const dir = `${base}_segments`;
    fs.mkdirSync(dir, { recursive: true });
    for (const seg of new Set(result.rows.map((r) => r.Segment))) {
      fs.writeFileSync(path.join(dir, `${seg}.csv`), toCsv(result.headers, result.rows.filter((r) => r.Segment === seg)));
    }
  }
  process.stdout.write(`${parsed.rows.length} in, ${result.rows.length} out\n${outFile}\n${reportFile}\n`);
}

main().catch((err) => { process.stderr.write(`Error: ${err.message}\n`); process.exit(1); });
