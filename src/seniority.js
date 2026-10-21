'use strict';

const { words } = require('./text');

function hasKeyword(title, keyword) {
  return ` ${title} `.includes(` ${words(keyword)} `);
}

// Segment from the job title, using config/seniority.json.
function classifyTitle(title, rules) {
  const t = words(title);
  if (!t) return { ...rules.default };
  for (const group of [...(rules.overrides || []), ...rules.levels]) {
    if (group.keywords.some((k) => hasKeyword(t, k))) return { segment: group.segment, rank: group.rank };
  }
  return { ...rules.default };
}

module.exports = { classifyTitle };
