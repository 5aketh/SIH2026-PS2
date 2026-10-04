import { STORAGE_TYPES, TRANSPORT_MODES, optionLabel } from '../data/wizard';
import { days } from './format';

/** One-line recap of the user's own conditions, e.g. "chilled storage at 12 °C, 85% RH · …". */
export function conditionsSummary(state) {
  const c = state.conditions;
  const parts = [];
  if (c.storageType) {
    let s = optionLabel(STORAGE_TYPES, c.storageType).toLowerCase() + ' storage';
    if (c.temperatureC !== '') s += ` at ${c.temperatureC} °C`;
    if (c.relativeHumidityPct !== '') s += `, ${c.relativeHumidityPct}% RH`;
    parts.push(s);
  }
  if (c.targetShelfLifeDays !== '') parts.push(`${c.targetShelfLifeDays}-day target shelf life`);
  if (c.transportMode) {
    parts.push(c.transportMode === 'none'
      ? 'no transport'
      : `${optionLabel(TRANSPORT_MODES, c.transportMode).toLowerCase()} transport${c.transportStress ? `, ${c.transportStress} stress` : ''}`);
  }
  return parts.join(' · ');
}

/** One plain sentence on the result, built only from what the backend returned. */
export function verdictLine(result, foodName) {
  const structure = result.recommendation?.structure;
  const s = result.shelfLife;
  const food = foodName || 'this food';
  if (!structure) return null;
  if (!s || !days(s.estimateDays) || typeof s.meetsTarget !== 'boolean') return `The best match for ${food}.`;
  return s.meetsTarget
    ? `Should keep ${food} in good condition for about ${days(s.estimateDays)}, meeting your ${s.targetDays}-day target.`
    : `The closest match, but ${food} is expected to last about ${days(s.estimateDays)}, short of your ${s.targetDays}-day target.`;
}
