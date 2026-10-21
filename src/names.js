'use strict';

const { key, isBlank } = require('./text');

function capitalizeWord(word) {
  // Handles hyphens and apostrophes: "jean-luc" -> "Jean-Luc", "o'brien" -> "O'Brien".
  return word.split('-').map((part) =>
    part.split("'").map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join("'")
  ).join('-');
}

// Only rewrites names typed all in upper or all in lower case.
// Mixed case ("McDonald", "DeAndre") is assumed intentional and kept.
// In a last name, a leading particle stays lowercase too ("dos Santos").
function fixCase(name, particles, { lastName = false } = {}) {
  const s = String(name || '').trim().replace(/\s+/g, ' ');
  if (!s) return s;
  const hasLetters = /\p{L}/u.test(s);
  if (!hasLetters || (s !== s.toUpperCase() && s !== s.toLowerCase())) return s;
  return s.toLowerCase().split(' ').map((w, i) =>
    (i > 0 || lastName) && particles.has(w) ? w : capitalizeWord(w)
  ).join(' ');
}

function splitFullName(full, particles) {
  const parts = fixCase(full, particles).split(' ').filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// Guesses a name from the email local part, with an explicit confidence:
//   pattern          "anna.smith@" -> Anna Smith (reliable)
//   first_name_list  "anna@" and "anna" is in config/first_names.txt
//   suggestion       "asmith@" -> only a note, never written into the name columns
// Writing a wrong name is worse than leaving it blank.
function nameFromEmail(email, cfg) {
  const local = String(email || '').split('@')[0].toLowerCase().replace(/\+.*$/, '');
  if (!local || cfg.rolePrefixes.has(local)) return null;
  const tokens = local.replace(/[0-9]/g, '').split(/[._-]+/).filter((t) => t.length >= 2);
  if (tokens.length >= 2) {
    return {
      first: capitalizeWord(tokens[0]),
      last: tokens.slice(1).map(capitalizeWord).join(' '),
      confidence: 'pattern',
    };
  }
  if (tokens.length === 1) {
    const t = tokens[0];
    if (cfg.firstNames.has(key(t))) return { first: capitalizeWord(t), last: '', confidence: 'first_name_list' };
    if (t.length >= 5) {
      return {
        first: '', last: '', confidence: 'suggestion',
        note: `possible initial + last name "${capitalizeWord(t.slice(1))}", not confirmed, review manually`,
      };
    }
  }
  return null;
}

function fillNames(row, cfg) {
  const notes = [];
  if (!isBlank(row['Full Name']) && isBlank(row['First Name']) && isBlank(row['Last Name'])) {
    const { first, last } = splitFullName(row['Full Name'], cfg.particles);
    row['First Name'] = first;
    row['Last Name'] = last;
  }
  row['First Name'] = fixCase(row['First Name'], cfg.particles);
  row['Last Name'] = fixCase(row['Last Name'], cfg.particles, { lastName: true });
  if (isBlank(row['First Name']) && !isBlank(row.Email)) {
    const guess = nameFromEmail(row.Email, cfg);
    if (guess && guess.confidence === 'suggestion') notes.push(guess.note);
    else if (guess) {
      row['First Name'] = guess.first;
      if (isBlank(row['Last Name'])) row['Last Name'] = guess.last;
      notes.push(guess.confidence === 'pattern'
        ? 'name taken from email pattern'
        : 'first name confirmed by first_names list');
    }
  }
  return notes;
}

module.exports = { fixCase, splitFullName, nameFromEmail, fillNames };
