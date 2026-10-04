/*
 * Hardcoded profiles for custom commodities that aren't in the catalog.
 * When a custom name (or the landing-page description) mentions one of the
 * keywords, the profile step opens prefilled instead of blank. Values come
 * from the blueprint's worked examples 7 and 8 and are estimates, not
 * IFCT-verified, so every field is labelled "prototype estimate".
 */

function f(value, provenance = 'prototype estimate', confidence = 'prototype') {
  return { value, provenance, confidence };
}

export const CUSTOM_PRESETS = [
  {
    presetId: 'MANGO_PICKLE_OIL',
    name: 'Mango pickle (oil-based)',
    // Local names: Telugu Avakaya, Hindi aam ka achaar, Kannada mavinakayi uppinakayi.
    keywords: ['mango pickle', 'avakaya', 'aavakaya', 'avakai', 'aam ka achar', 'aam ka achaar', 'mango achar', 'mango achaar', 'uppinakayi', 'pickle', 'achar', 'achaar'],
    category: 'other',
    moisturePct: f(48),
    fatPct: f(18.5),
    ph: f(3.6),
    respirationClass: f('none', 'rule-derived'),
    oxidationSensitivity: f('high', 'rule-derived'),
    source: 'Hardcoded example: Avakaya mango pickle (blueprint example 7), prototype estimate',
  },
  {
    presetId: 'TURMERIC_POWDER',
    name: 'Turmeric powder',
    // Local names: Hindi haldi, Tamil manjal, Kannada arishina, Marathi halad.
    keywords: ['turmeric', 'haldi', 'manjal', 'arishina', 'halad'],
    category: 'dry_goods',
    moisturePct: f(8.5),
    fatPct: f(6),
    ph: f(6.2),
    respirationClass: f('none', 'rule-derived'),
    oxidationSensitivity: f('medium', 'rule-derived'),
    source: 'Hardcoded example: Erode turmeric powder (blueprint example 8), prototype estimate',
  },
];

const normalize = (text) => ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** First preset whose keyword appears as whole words in any of the given texts, or null. */
export function matchCustomPreset(...texts) {
  const haystack = texts.map(normalize).join(' ');
  return CUSTOM_PRESETS.find((p) => p.keywords.some((k) => haystack.includes(normalize(k)))) || null;
}
