'use strict';

const { key, words, isBlank } = require('./text');

// Post-enrichment sanity check. Runs last, after any LinkedIn or job title lookup.
//
// A personal LinkedIn URL belongs to one person. When two contacts end up with the
// same "confirmed" URL, at least one of them is wrong: results got shifted while being
// merged back into the list. Wrong data is worse than missing data, so the rows that
// do not match the URL are cleared and downgraded to not_found.

const URL = 'LinkedIn URL';
const URL_STATUS = 'LinkedIn Status';
const TITLE = 'Enriched Title';
const TITLE_STATUS = 'Enriched Title Status';

function normalizeUrl(url) {
  return String(url || '').toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

function slugOf(url) {
  const m = normalizeUrl(url).match(/\/in\/([^/]+)/);
  return m ? key(decodeURIComponent(m[1])) : '';
}

function nameMatchesSlug(row, slug, particles) {
  const tokens = words(`${row['First Name'] || ''} ${row['Last Name'] || ''}`)
    .split(' ').filter((t) => t.length >= 2 && !particles.has(t));
  if (!tokens.length || !slug) return false;
  const hits = tokens.filter((t) => slug.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

function titleMentionsCompany(row) {
  const title = key(row[TITLE]);
  const company = words(row.Company).split(' ').filter((w) => w.length >= 3);
  if (!title || !company.length) return false;
  return title.includes(company.join('')) || company.some((w) => w.length >= 4 && title.includes(w));
}

function clearUrl(row, changes, why) {
  changes.push({ name: `${row['First Name']} ${row['Last Name']}`.trim(), field: URL, was: row[URL], why });
  row[URL] = '';
  row[URL_STATUS] = 'not_found';
  clearTitle(row, changes, 'title came with a URL that belongs to someone else');
}

function clearTitle(row, changes, why) {
  if (isBlank(row[TITLE])) return;
  changes.push({ name: `${row['First Name']} ${row['Last Name']}`.trim(), field: TITLE, was: row[TITLE], why });
  row[TITLE] = '';
  row[TITLE_STATUS] = 'not_found';
}

function checkCrossContamination(rows, particles = new Set()) {
  const changes = [];
  const byUrl = new Map();
  for (const row of rows) {
    if (row[URL_STATUS] !== 'confirmed' || isBlank(row[URL])) continue;
    const u = normalizeUrl(row[URL]);
    if (!byUrl.has(u)) byUrl.set(u, []);
    byUrl.get(u).push(row);
  }
  for (const group of byUrl.values()) {
    if (group.length < 2) continue;
    const slug = slugOf(group[0][URL]);
    for (const row of group) {
      if (!nameMatchesSlug(row, slug, particles)) clearUrl(row, changes, 'same URL as another contact, name does not match the profile');
      else if (!isBlank(row[TITLE]) && !titleMentionsCompany(row)) clearTitle(row, changes, 'title does not mention this contact\'s company');
    }
  }
  // Same enriched title, word for word, on contacts from different companies.
  const byTitle = new Map();
  for (const row of rows) {
    if (isBlank(row[TITLE])) continue;
    if (!byTitle.has(row[TITLE])) byTitle.set(row[TITLE], []);
    byTitle.get(row[TITLE]).push(row);
  }
  for (const group of byTitle.values()) {
    const companies = new Set(group.map((r) => key(r.Company)));
    if (group.length < 2 || companies.size < 2) continue;
    for (const row of group) if (!titleMentionsCompany(row)) clearTitle(row, changes, 'identical title on contacts from different companies');
  }
  return changes;
}

module.exports = { checkCrossContamination, normalizeUrl, slugOf };
