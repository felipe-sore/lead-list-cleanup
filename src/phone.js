'use strict';

const { parsePhoneNumberFromString, getCountries } = require('libphonenumber-js');
const { key, isBlank } = require('./text');

// Country column may hold "BR", "Brazil", "Brasil" or "Brasil " depending on the export.
// Built once from the ISO list, with English, Portuguese and Spanish names.
let countryIndex;
function countryCode(value) {
  if (isBlank(value)) return null;
  const v = String(value).trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  if (!countryIndex) {
    countryIndex = new Map();
    for (const lang of ['en', 'pt', 'es']) {
      let names;
      try { names = new Intl.DisplayNames([lang], { type: 'region' }); } catch { continue; }
      for (const code of getCountries()) {
        const name = names.of(code);
        if (name && !countryIndex.has(key(name))) countryIndex.set(key(name), code);
      }
    }
    for (const [alias, code] of [['usa', 'US'], ['eua', 'US'], ['uk', 'GB'], ['england', 'GB']]) countryIndex.set(alias, code);
  }
  return countryIndex.get(key(v)) || null;
}

// Returns E.164 when the number is valid. Never drops a number:
// an invalid one keeps its original text and is flagged.
function normalizePhone(raw, { country, defaultCountry } = {}) {
  if (isBlank(raw)) return { phone: '', status: 'missing' };
  let text = String(raw).trim().replace(/^00/, '+');
  const region = countryCode(country) || (defaultCountry ? defaultCountry.toUpperCase() : undefined);
  let parsed = parsePhoneNumberFromString(text, region);
  if (parsed && parsed.isValid()) return { phone: parsed.number, status: 'valid', country: parsed.country };
  // Digits that already start with a country code but lost the "+" in the export.
  const digits = text.replace(/\D/g, '');
  if (!text.startsWith('+') && digits.length >= 11) {
    parsed = parsePhoneNumberFromString('+' + digits);
    if (parsed && parsed.isValid()) {
      return { phone: parsed.number, status: 'valid', country: parsed.country, note: 'country code inferred from digits' };
    }
  }
  return { phone: String(raw).trim(), status: 'invalid' };
}

module.exports = { normalizePhone, countryCode };
