/*
 * Landing-page narrative (build spec §5). Each stage maps to a real step of
 * the analysis pipeline (§7.2); don't add decorative stages here.
 */
export const PIPELINE = [
  {
    title: 'Food commodity',
    text: 'Pick a food from the catalog or describe your own.',
    chips: ['Tomato', 'Potato chips', 'Custom food'],
  },
  {
    title: 'Food properties split out',
    text: 'Typical food characteristics load with their source, and you can edit any of them.',
    chips: ['Moisture', 'Fat', 'pH', 'Respiration', 'Oxidation sensitivity'],
  },
  {
    title: 'Deterioration risks become visible',
    text: 'Those properties, plus storage and transport conditions, show what could go wrong.',
    chips: ['Moisture ingress', 'Oxidation', 'Respiration', 'Handling damage'],
  },
  {
    title: 'Packaging requirements appear',
    text: 'Each risk becomes a requirement, before any material is named.',
    chips: ['OTR target', 'WVTR target', 'Thickness', 'Sealability', 'MAP'],
  },
  {
    title: 'Candidate materials enter the scene',
    text: 'Structures that break a hard constraint or are incompatible are filtered out.',
    chips: ['Hard constraints', 'Compatibility filter'],
  },
  {
    title: 'AI, rules and optimization converge',
    text: 'The remaining candidates are scored against your priorities.',
    chips: ['Domain rules', 'Model estimates', 'Your priorities'],
  },
  {
    title: 'Recommended package + specifications',
    text: 'One structure, the reasons behind it, and the alternatives you could choose instead.',
    chips: ['Structure', 'Why this?', 'Alternatives', 'Provenance labels'],
  },
];
