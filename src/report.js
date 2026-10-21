'use strict';

function table(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '_none_\n';
  return ['| value | count |', '|---|---|', ...entries.map(([k, v]) => `| ${k} | ${v} |`)].join('\n') + '\n';
}

function countBy(rows, column) {
  const out = {};
  for (const r of rows) {
    const v = r[column] === undefined || r[column] === '' ? '(blank)' : String(r[column]);
    out[v] = (out[v] || 0) + 1;
  }
  return out;
}

function buildReport({ inputCount, rows, removed, integrity, options }) {
  const removedBy = {};
  for (const { reason } of removed) removedBy[reason] = (removedBy[reason] || 0) + 1;
  const lines = [
    '# Lead list cleanup report',
    '',
    `- Contacts in: **${inputCount}**`,
    `- Removed: **${removed.length}**`,
    `- Contacts out: **${rows.length}**`,
    `- Options: ${Object.entries(options).filter(([, v]) => v).map(([k, v]) => (v === true ? k : `${k}=${v}`)).join(', ') || 'defaults'}`,
    '',
    '## Removed, by reason',
    table(removedBy),
    '## Segment',
    table(countBy(rows, 'Segment')),
    '## Email status',
    table(countBy(rows, 'Email Status')),
    `Generic mailboxes flagged (not removed): ${rows.filter((r) => r['Generic Email'] === 'true').length}`,
    '',
    '## Phone status',
    table(countBy(rows, 'Phone Status')),
  ];
  for (const col of ['Email Verification', 'WhatsApp', 'Website Status']) {
    if (rows.some((r) => r[col] !== undefined && r[col] !== '')) lines.push(`## ${col}`, table(countBy(rows, col)));
  }
  lines.push('## Integrity check (LinkedIn and enriched titles)');
  if (!integrity.length) lines.push('No cross-contamination found.', '');
  else {
    lines.push('| contact | field cleared | value | why |', '|---|---|---|---|');
    for (const c of integrity) lines.push(`| ${c.name} | ${c.field} | ${c.was} | ${c.why} |`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = { buildReport };
