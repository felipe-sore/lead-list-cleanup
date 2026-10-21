'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyTitle } = require('../src/seniority');
const { cfg } = require('./helpers');

const seg = (t) => classifyTitle(t, cfg.seniority).segment;

test('classifies titles in English, Portuguese and Spanish', () => {
  assert.equal(seg('VP of Sales'), 'decision_maker');
  assert.equal(seg('Co-Founder & CEO'), 'decision_maker');
  assert.equal(seg('Diretora Comercial'), 'decision_maker');
  assert.equal(seg('Head of Growth'), 'management');
  assert.equal(seg('Gerente de Marketing'), 'management');
  assert.equal(seg('Coordinador de Ventas'), 'coordination');
  assert.equal(seg('Sales Analyst'), 'individual_contributor');
  assert.equal(seg(''), 'other');
});

test('assistants are never decision makers', () => {
  assert.equal(seg('Assistant to the CEO'), 'individual_contributor');
  assert.equal(seg('Executive Assistant'), 'individual_contributor');
});

test('matches whole words only', () => {
  assert.equal(seg('Headhunter'), 'other');
});
