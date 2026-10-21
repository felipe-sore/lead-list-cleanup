'use strict';

const { loadConfig } = require('../src/config');

const cfg = loadConfig();
module.exports = { cfg };
