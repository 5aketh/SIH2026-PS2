/*
 * Which storage a food can physically take, checked before any analysis is
 * requested. The rules and their messages come from the backend
 * (GET /api/storage-rules, engine/storage.py); this mirrors its check so the
 * UI can explain the problem inline. The backend stays authoritative.
 */
import { STORAGE_TYPES, optionLabel } from '../data/wizard';

/** The rule for one food: its catalog rule, else its category's, with the name filled in. */
export function storageRuleFor(rules, { commodityId, name, category }) {
  if (!rules) return null;
  if (commodityId && rules.commodities[commodityId]) return { ...rules.commodities[commodityId], name };
  const cat = rules.categories[category] || rules.categories.other;
  if (!cat) return null;
  const label = name?.trim() || 'this food';
  const messages = Object.fromEntries(Object.entries(cat.messages || {}).map(([k, v]) => [k, v.replaceAll('{name}', label)]));
  return { ...cat, messages, name: label };
}

/** e.g. "Tomato: chilled or ambient storage only, at 10 °C or warmer." Null when nothing is restricted. */
export function storageHint(rule) {
  if (!rule) return null;
  const all = STORAGE_TYPES.map((o) => o.value);
  const limited = rule.allowedStorage.length < all.length;
  if (!limited && rule.minTemperatureC === null) return null;
  const parts = [];
  if (limited) parts.push(`${rule.allowedStorage.map((t) => optionLabel(STORAGE_TYPES, t).toLowerCase()).join(' or ')} storage only`);
  if (rule.minTemperatureC !== null) parts.push(`at ${rule.minTemperatureC} °C or warmer`);
  return `${rule.name}: ${parts.join(', ')}.`;
}

/** Field errors ({ storageType?, temperatureC? }) when the conditions break the rule. */
export function storageErrors(rule, conditions) {
  if (!rule || !conditions.storageType) return {};
  if (!rule.allowedStorage.includes(conditions.storageType)) {
    return {
      storageType: rule.messages[conditions.storageType]
        || `${optionLabel(STORAGE_TYPES, conditions.storageType)} storage isn't supported for ${rule.name}.`,
    };
  }
  const t = conditions.temperatureC === '' ? NaN : Number(conditions.temperatureC);
  if (rule.minTemperatureC !== null && Number.isFinite(t) && t < rule.minTemperatureC) {
    return { temperatureC: rule.messages.minTemperature };
  }
  return {};
}
