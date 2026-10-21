'use strict';

const fs = require('fs');
const path = require('path');

// Every list the cleaner relies on lives in config/ so each user can adapt it
// to their market. LEAD_CLEANUP_CONFIG_DIR points to a custom copy.
function configDir() {
  return process.env.LEAD_CLEANUP_CONFIG_DIR || path.join(__dirname, '..', 'config');
}

function readList(file) {
  const full = path.join(configDir(), file);
  if (!fs.existsSync(full)) return new Set();
  return new Set(
    fs.readFileSync(full, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l && !l.startsWith('#'))
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(configDir(), file), 'utf8'));
}

function loadConfig() {
  return {
    headers: readJson('headers.json'),
    seniority: readJson('seniority.json'),
    particles: readList('name_particles.txt'),
    rolePrefixes: readList('role_prefixes.txt'),
    disposableDomains: readList('disposable_domains.txt'),
    freeProviders: readList('free_providers.txt'),
    firstNames: readList('first_names.txt'),
  };
}

module.exports = { loadConfig, configDir };
