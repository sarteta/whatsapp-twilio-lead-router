// Rule-first intent classifier.
// The whole point: cheap, deterministic, explainable. The LLM is fallback
// only -- it NEVER sees traffic we can handle with rules.

export const INTENTS = Object.freeze([
  'buyer',
  'seller',
  'investor',
  'nurture',
  'stop',
  'help',
  'spam',
]);

const RULES = [
  // Order matters: STOP/HELP must win before anything else.
  { intent: 'stop', pattern: /^(stop|stopall|unsubscribe|cancel|end|quit)\b/i },
  { intent: 'help', pattern: /^help\b/i },

  // Obvious spam -- URL-only payloads, known spam hooks.
  { intent: 'spam', pattern: /^\s*https?:\/\/\S+\s*$/i },
  { intent: 'spam', pattern: /\b(click here|win prize|free iphone|bitcoin giveaway)\b/i },

  // Seller signals -- these are strong; check before buyer.
  { intent: 'seller', pattern: /\b(sell(ing)? (my )?(home|house|property))\b/i },
  { intent: 'seller', pattern: /\b(cash offer|home valuation|what'?s my house worth|list my)\b/i },

  // Investor signals.
  { intent: 'investor', pattern: /\b(investor|wholesale|off[- ]market|fix (and|&) flip|portfolio|brrrr)\b/i },

  // Buyer signals.
  { intent: 'buyer', pattern: /\b(looking to buy|house hunting|interested in (this|the) (house|listing|property|home))\b/i },
  { intent: 'buyer', pattern: /\b(schedule (a )?(tour|showing|viewing)|can i see|is it (still )?available)\b/i },
  { intent: 'buyer', pattern: /\b(pre[- ]?approved|mortgage|down payment|budget.{0,20}\$)\b/i },
];

export function classifyByRules(text) {
  if (!text || typeof text !== 'string') {
    return { intent: 'spam', confidence: 1.0, reason: 'empty-or-nonstring' };
  }
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return {
        intent: rule.intent,
        confidence: 0.95,
        reason: `rule:${rule.pattern.source.slice(0, 40)}`,
      };
    }
  }
  return { intent: null, confidence: 0, reason: 'no-rule-matched' };
}

/**
 * LLM fallback -- called only when `classifyByRules` returns `intent: null`.
 * Strict output contract: must return one of INTENTS; anything else collapses
 * to `nurture` (the safe, non-damaging default).
 */
export async function classifyByLLM(text, llmDriver) {
  if (!llmDriver) {
    return { intent: 'nurture', confidence: 0.3, reason: 'llm-disabled-default-nurture' };
  }
  const raw = await llmDriver.classify(text, INTENTS);
  const cleaned = String(raw || '').trim().toLowerCase();
  if (INTENTS.includes(cleaned)) {
    return { intent: cleaned, confidence: 0.7, reason: 'llm' };
  }
  return { intent: 'nurture', confidence: 0.3, reason: `llm-invalid-output:${cleaned.slice(0, 30)}` };
}

/**
 * Top-level classifier: rules first, LLM only if ambiguous.
 */
export async function classify(text, llmDriver = null) {
  const ruled = classifyByRules(text);
  if (ruled.intent) return ruled;
  return classifyByLLM(text, llmDriver);
}
