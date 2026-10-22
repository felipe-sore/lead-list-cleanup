'use strict';

// Minimal RFC 4180 CSV reader/writer, no dependencies.
// Detects the delimiter (, ; or tab) from the header line, which covers
// exports from spreadsheets set to European or Brazilian locales.

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ',';
}

function parseRecords(text, delimiter) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { record.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field); field = '';
      records.push(record); record = [];
    } else field += ch;
  }
  if (field !== '' || record.length) { record.push(field); records.push(record); }
  return records.filter((r) => r.some((v) => v.trim() !== ''));
}

function parseCsv(input) {
  const text = String(input).replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const [headerRow = [], ...body] = parseRecords(text, delimiter);
  const headers = headerRow.map((h) => h.trim());
  const rows = body.map((values) => {
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
    return row;
  });
  return { headers, rows, delimiter };
}

// A cell that starts with = + - @ (or a tab or carriage return) runs as a
// formula when the CSV is opened in Excel or Google Sheets. Scraped titles and
// list values are untrusted, so such cells get a leading apostrophe and stay
// text. Plain numbers are left alone: "+5521998765432" is a phone, not a formula.
const NUMBER = /^[+-]?[\d\s().-]+$/;

function neutralizeFormula(s) {
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !NUMBER.test(s))) return `'${s}`;
  return s;
}

function escapeField(value) {
  const s = neutralizeFormula(value === undefined || value === null ? '' : String(value));
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) lines.push(headers.map((h) => escapeField(row[h])).join(','));
  return lines.join('\n') + '\n';
}

module.exports = { parseCsv, toCsv, detectDelimiter, neutralizeFormula };
