/* One-line explanations for packaging jargon, shown as tooltips by components/Term.jsx. */
export const GLOSSARY = {
  OTR: 'Oxygen transmission rate: how much oxygen passes through the film per square metre per day. Lower means a better oxygen barrier.',
  WVTR: 'Water vapour transmission rate: how much moisture passes through the film per square metre per day. Lower means a better moisture barrier.',
  EPR: 'Extended Producer Responsibility: the category under India’s plastic-waste rules that sets the brand owner’s recycling obligation and fee.',
  MAP: 'Modified atmosphere packaging: the air inside the pack is changed (less oxygen, more CO₂ or nitrogen) to slow spoilage.',
  'Gelbo flex': 'A lab test that repeatedly crumples a film and counts the pinholes it develops, a proxy for cracking in transport.',
  'mechanical index': 'A 0–100 score for how well the pack resists puncture, tearing and flex-cracking.',
  'cost band': 'Low, medium or high packaging cost per pack relative to the other candidates.',
  'Mono-material': 'Made of a single plastic family, which makes it recyclable in existing streams.',
};

// Longest first so "Gelbo flex" wins over a shorter overlapping term.
export const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
