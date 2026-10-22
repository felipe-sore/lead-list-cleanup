'use strict';

const { key } = require('./text');

// Maps whatever headers the export has to the canonical columns in
// config/headers.json. Unknown columns are kept, untouched, after the canonical ones.
// A header named exactly like a canonical column wins over an alias ("Phone" beats
// "Mobile"), and a leftover column whose name would collide with a canonical or
// reserved one is renamed ("Mobile" stays "Mobile", a second "Notes" becomes
// "Notes (2)"), so no input column is ever overwritten.
function mapHeaders(headers, aliases, reserved = []) {
  const canonicals = Object.keys(aliases).filter((c) => !c.startsWith('_'));
  const exact = new Map(canonicals.map((c) => [key(c), c]));
  const lookup = new Map();
  for (const canonical of canonicals) {
    for (const alias of aliases[canonical]) if (!lookup.has(key(alias))) lookup.set(key(alias), canonical);
  }
  const mapping = {};
  const used = new Set();
  for (const h of headers) {
    const canonical = exact.get(key(h));
    if (canonical && !used.has(canonical)) { mapping[h] = canonical; used.add(canonical); }
  }
  for (const h of headers) {
    if (mapping[h]) continue;
    const canonical = lookup.get(key(h));
    if (canonical && !used.has(canonical)) { mapping[h] = canonical; used.add(canonical); }
  }
  const taken = new Set([...canonicals, ...reserved].map(key));
  const extra = [];
  for (const h of headers) {
    if (mapping[h]) continue;
    let name = h;
    for (let n = 2; taken.has(key(name)); n++) name = `${h} (${n})`;
    taken.add(key(name));
    if (name !== h) mapping[h] = name;
    extra.push(name);
  }
  return { mapping, extra };
}

function remapRow(row, mapping) {
  const out = {};
  for (const [from, value] of Object.entries(row)) out[mapping[from] || from] = value;
  return out;
}

module.exports = { mapHeaders, remapRow };
