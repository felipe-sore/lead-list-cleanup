'use strict';

const { key } = require('./text');

// Maps whatever headers the export has to the canonical columns in
// config/headers.json. Unknown columns are kept, untouched, after the canonical ones.
function mapHeaders(headers, aliases) {
  const lookup = new Map();
  for (const [canonical, list] of Object.entries(aliases)) {
    if (canonical.startsWith('_')) continue;
    lookup.set(key(canonical), canonical);
    for (const alias of list) if (!lookup.has(key(alias))) lookup.set(key(alias), canonical);
  }
  const mapping = {};
  const used = new Set();
  const extra = [];
  for (const h of headers) {
    const canonical = lookup.get(key(h));
    if (canonical && !used.has(canonical)) { mapping[h] = canonical; used.add(canonical); }
    else extra.push(h);
  }
  return { mapping, extra };
}

function remapRow(row, mapping) {
  const out = {};
  for (const [from, value] of Object.entries(row)) out[mapping[from] || from] = value;
  return out;
}

module.exports = { mapHeaders, remapRow };
