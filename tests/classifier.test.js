import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyByRules, classify } from '../src/classifier.js';

test('STOP → stop (case-insensitive)', () => {
  assert.equal(classifyByRules('STOP').intent, 'stop');
  assert.equal(classifyByRules('stop').intent, 'stop');
  assert.equal(classifyByRules('Unsubscribe').intent, 'stop');
});

test('HELP → help', () => {
  assert.equal(classifyByRules('HELP').intent, 'help');
});

test('buyer signals', () => {
  assert.equal(classifyByRules('Looking to buy a 3-bed under $500k').intent, 'buyer');
  assert.equal(classifyByRules('Can I schedule a tour for 123 Main?').intent, 'buyer');
  assert.equal(classifyByRules("I'm pre-approved, house hunting").intent, 'buyer');
});

test('seller signals', () => {
  assert.equal(classifyByRules('Selling my house, what is it worth?').intent, 'seller');
  assert.equal(classifyByRules('Looking for a cash offer on my property').intent, 'seller');
});

test('investor signals', () => {
  assert.equal(classifyByRules('Investor looking for off-market deals').intent, 'investor');
  assert.equal(classifyByRules('fix and flip opportunities in Denver').intent, 'investor');
});

test('pure URL → spam', () => {
  assert.equal(classifyByRules('https://spam.example/prize').intent, 'spam');
});

test('ambiguous returns null intent (LLM fallback territory)', () => {
  const result = classifyByRules('thanks');
  assert.equal(result.intent, null);
});

test('classify() with LLM-disabled defaults ambiguous → nurture', async () => {
  const result = await classify('thanks', null);
  assert.equal(result.intent, 'nurture');
});

test('classify() honors LLM output when rules miss', async () => {
  const llm = { async classify() { return 'buyer'; } };
  const result = await classify('hmm interesting', llm);
  assert.equal(result.intent, 'buyer');
});

test('classify() collapses invalid LLM output to nurture', async () => {
  const llm = { async classify() { return 'definitely-not-a-valid-label'; } };
  const result = await classify('hmm', llm);
  assert.equal(result.intent, 'nurture');
});
