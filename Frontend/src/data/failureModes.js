/*
 * Plain-language explanations of the engine's limiting factors (the
 * `failureMode` strings from backend/app/engine/shelf_life.py). Display copy
 * only; the engine decides which one applies.
 *
 * `barrierHelps` says whether a better oxygen/moisture barrier would extend
 * shelf life: false for breathing produce, where sealing tighter makes things
 * worse, and for limits set by the food itself.
 */
const MODES = {
  'senescence and ripening': {
    text: 'The produce ripens and ages at its natural rate. Packaging barely changes this; cooler storage does.',
    barrierHelps: false,
  },
  'senescence (slowed by modified atmosphere)': {
    text: 'The low-oxygen atmosphere inside the pack slows ageing, but ageing still sets the limit.',
    barrierHelps: false,
  },
  'anaerobic fermentation': {
    text: 'Oxygen inside the pack drops so low that the produce starts fermenting and goes off. It needs more gas exchange, not more barrier.',
    barrierHelps: false,
  },
  'anaerobic fermentation during the transit excursion': {
    text: 'During the warmer transport leg, oxygen in the pack drops too low and the produce starts fermenting. It needs more gas exchange, not more barrier.',
    barrierHelps: false,
  },
  'CO₂ injury': {
    text: 'Carbon dioxide from the breathing produce builds up past what it tolerates and damages it. More ventilation helps, not more barrier.',
    barrierHelps: false,
  },
  'dehydration (weight loss)': {
    text: 'The food loses water through the film and wilts or shrivels. A better moisture barrier helps.',
    barrierHelps: true,
  },
  'moisture gain (texture loss or caking)': {
    text: 'Moisture from the air gets in through the film, so the food goes soft, stale or caked. A better moisture barrier helps.',
    barrierHelps: true,
  },
  'moisture loss (drying or freezer burn)': {
    text: 'Water escapes through the film and the food dries out. A better moisture barrier helps.',
    barrierHelps: true,
  },
  'lipid oxidation (rancidity)': {
    text: 'Fats react with oxygen and light getting through the pack and turn rancid. A better oxygen or light barrier helps.',
    barrierHelps: true,
  },
  'microbial spoilage': {
    text: 'Microbes grow until the food spoils. Temperature and hygiene matter most; a protective gas atmosphere can slow it, but no barrier stops it.',
    barrierHelps: false,
  },
  'not limited by any modelled mechanism': {
    text: 'None of the spoilage routes PackWise models limits this food in this pack.',
    barrierHelps: false,
  },
};

/** { text, barrierHelps } for a failure mode, or null for one this file doesn't know yet. */
export function failureMode(mode) {
  return MODES[mode] || null;
}
