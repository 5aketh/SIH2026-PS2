import AppleIcon from '../components/icons/AppleIcon';
import WheatIcon from '../components/icons/WheatIcon';
import MilkCartonIcon from '../components/icons/MilkCartonIcon';
import FishIcon from '../components/icons/FishIcon';
import ChipBagIcon from '../components/icons/ChipBagIcon';
import OilBottleIcon from '../components/icons/OilBottleIcon';

/*
 * Wizard vocabulary. Enum values mirror the API contract (build spec §6–7);
 * labels are display-only.
 */

export const WIZARD_STEPS = [
  { id: 'food', title: 'Food', path: '/analyze/food' },
  { id: 'journey', title: 'Journey', path: '/analyze/journey' },
  { id: 'result', title: 'Result', path: '/analyze/result' },
];

// `cat` reuses the landing page's category colour scopes and icons.
export const FOOD_CATEGORIES = [
  { value: 'fresh_produce', label: 'Fresh produce', cat: 'produce', Icon: AppleIcon },
  { value: 'dry_goods', label: 'Dry goods', cat: 'grains', Icon: WheatIcon },
  { value: 'dairy', label: 'Dairy', cat: 'dairy', Icon: MilkCartonIcon },
  { value: 'meat_seafood', label: 'Meat & seafood', cat: 'meat', Icon: FishIcon },
  { value: 'snack', label: 'Snacks', cat: 'snacks', Icon: ChipBagIcon },
  { value: 'other', label: 'Other', cat: 'oils', Icon: OilBottleIcon },
];

export function foodCategory(value) {
  return FOOD_CATEGORIES.find((c) => c.value === value) || FOOD_CATEGORIES[FOOD_CATEGORIES.length - 1];
}

/** Landing-page category card id → wizard category. */
export const LANDING_CATEGORY_MAP = {
  produce: 'fresh_produce',
  grains: 'dry_goods',
  dairy: 'dairy',
  meat: 'meat_seafood',
  snacks: 'snack',
  oils: 'other',
};

export const RESPIRATION_CLASSES = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const SENSITIVITY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const STORAGE_TYPES = [
  { value: 'ambient', label: 'Ambient' },
  { value: 'chilled', label: 'Chilled' },
  { value: 'frozen', label: 'Frozen' },
];

export const TRANSPORT_MODES = [
  { value: 'none', label: 'None' },
  { value: 'ambient_transport', label: 'Ambient' },
  { value: 'refrigerated_transport', label: 'Refrigerated' },
  { value: 'frozen_transport', label: 'Frozen' },
];

export const TRANSPORT_STRESS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const PROFILE_FIELDS = {
  category: { label: 'Category' },
  moisturePct: { label: 'Moisture', unit: '%', min: 0, max: 100, step: 0.1 },
  fatPct: { label: 'Fat', unit: '%', min: 0, max: 100, step: 0.1 },
  ph: { label: 'pH', min: 0, max: 14, step: 0.1 },
  respirationClass: { label: 'Respiration class' },
  oxidationSensitivity: { label: 'Oxidation sensitivity' },
};

export const CONDITION_FIELDS = {
  storageType: { label: 'Storage type' },
  temperatureC: { label: 'Storage temperature', unit: '°C', min: -40, max: 60, step: 0.5 },
  relativeHumidityPct: { label: 'Relative humidity', unit: '%', min: 0, max: 100, step: 1 },
  targetShelfLifeDays: { label: 'Target shelf life', unit: 'days', min: 1, max: 3650, step: 1 },
  transportMode: { label: 'Transport mode' },
  transportStress: { label: 'Transport stress' },
};

export const PRIORITY_FIELDS = [
  { key: 'shelfLife', label: 'Shelf life', hint: 'Keep the food in good condition for longer.', color: 'var(--produce)' },
  { key: 'cost', label: 'Cost', hint: 'Keep the packaging cost band down.', color: 'var(--grains)' },
  { key: 'sustainability', label: 'Sustainability', hint: 'Prefer recyclable or lower-impact structures.', color: 'var(--dairy)' },
  { key: 'mechanicalStrength', label: 'Mechanical strength', hint: 'Protect against handling and transport damage.', color: 'var(--meat)' },
];

/*
 * Hard constraints. Values are the backend's vocabulary (engine/gatekeeper.py)
 * and never shown; labels match gatekeeper.describe().
 */
export const CONSTRAINT_SUGGESTIONS = [
  { value: 'recyclable:true', label: 'Must be recyclable' },
  { value: 'mono_material:true', label: 'Single material only' },
  { value: 'compostable:true', label: 'Must be compostable' },
  { value: 'no_metallised:true', label: 'No metallised or foil layers' },
  { value: 'max_cost_band:low', label: 'Low cost band at most' },
  { value: 'max_cost_band:medium', label: 'Medium cost band at most' },
];

/** Constraints with one value at a time: picking one replaces the others. */
export const EXCLUSIVE_CONSTRAINT_PREFIXES = ['max_cost_band:', 'max_gauge_um:'];

export const excludeMaterial = (materialId) => `exclude_material:${materialId}`;
export const maxGauge = (um) => `max_gauge_um:${um}`;

/** A constraint in words, e.g. "exclude_material:AL_FOIL" -> "No Aluminium foil (9 µm)". */
export function constraintLabel(raw, materialNames = {}) {
  const hit = CONSTRAINT_SUGGESTIONS.find((s) => s.value === raw);
  if (hit) return hit.label;
  const [key, value = ''] = raw.split(':');
  if (key === 'exclude_material') return `No ${materialNames[value.toUpperCase()] || value}`;
  if (key === 'max_gauge_um') return `At most ${value} µm thick`;
  return raw;
}

/**
 * Reasoning stages for the analysis screen (spec §6.5). Ids match the
 * backend's result.trace, which says what each stage actually found.
 */
export const ANALYSIS_STAGES = [
  { id: 'profile', label: 'Reading food profile' },
  { id: 'risks', label: 'Checking deterioration risks' },
  { id: 'requirements', label: 'Deriving packaging requirements' },
  { id: 'filter', label: 'Filtering candidate materials' },
  { id: 'score', label: 'Scoring & optimizing' },
  { id: 'explain', label: 'Preparing explanation' },
];

export function optionLabel(options, value) {
  const hit = options.find((o) => o.value === value);
  return hit ? hit.label : value;
}
