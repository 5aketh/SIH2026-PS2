/*
 * Wizard state: reducer, validation and request building. Pure functions
 * only. Nothing here derives requirements or recommendations; that's the
 * backend's job (build spec §10).
 */
import { CONDITION_FIELDS, EXCLUSIVE_CONSTRAINT_PREFIXES, PROFILE_FIELDS } from '../data/wizard';
import { storageErrors } from './storage';

export const PROFILE_KEYS = ['category', 'moisturePct', 'fatPct', 'ph', 'respirationClass', 'oxidationSensitivity'];
const NUMERIC_PROFILE_KEYS = ['moisturePct', 'fatPct', 'ph'];
const NUMERIC_CONDITION_KEYS = ['temperatureC', 'relativeHumidityPct', 'targetShelfLifeDays'];
const EMPTY_PROFILE = Object.fromEntries(PROFILE_KEYS.map((k) => [k, '']));

export const initialState = {
  commodity: { commodityId: null, commodityName: '', isCustom: false },
  // Default-profile fetch for a predefined commodity (GET /api/commodities/{id}).
  commodityLoad: { status: 'idle', commodityId: null, name: '', error: null },
  // Field values are kept as strings while editing; meta tracks provenance per field.
  profile: { fields: EMPTY_PROFILE, meta: {}, source: null },
  // Free-text description and tags carried over from the landing page's custom form.
  notes: null,
  conditions: {
    storageType: '', temperatureC: '', relativeHumidityPct: '', targetShelfLifeDays: '',
    transportMode: '', transportStress: '',
  },
  priorities: { shelfLife: 0.5, cost: 0.5, sustainability: 0.5, mechanicalStrength: 0.5, hardConstraints: [] },
  analysis: { status: 'idle', result: null, payloadKey: null, error: null },
  // Server-side VALIDATION_ERRORs, keyed by contract field path (e.g. "conditions.temperatureC").
  fieldErrors: {},
  // Alternative indices included in the report comparison; null means all.
  compare: null,
};

/* ---------- Persistence (wizard input survives reloads and failed requests) ---------- */

const STORAGE_KEY = 'packwise-wizard-v1';

export function loadPersisted() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return initialState;
    return {
      ...initialState,
      commodity: { ...initialState.commodity, ...saved.commodity },
      profile: { ...initialState.profile, ...saved.profile, fields: { ...EMPTY_PROFILE, ...saved.profile?.fields } },
      notes: saved.notes || null,
      conditions: { ...initialState.conditions, ...saved.conditions },
      priorities: { ...initialState.priorities, ...saved.priorities },
      analysis: { ...initialState.analysis, result: saved.result || null, payloadKey: saved.payloadKey || null },
      compare: Array.isArray(saved.compare) ? saved.compare : null,
    };
  } catch {
    return initialState;
  }
}

export function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      commodity: state.commodity,
      profile: state.profile,
      notes: state.notes,
      conditions: state.conditions,
      priorities: state.priorities,
      result: state.analysis.result,
      payloadKey: state.analysis.payloadKey,
      compare: state.compare,
    }));
  } catch { /* storage unavailable */ }
}

export function clearPersisted() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
}

/* ---------- Reducer ---------- */

function profileFromPayload(p) {
  const fields = { ...EMPTY_PROFILE };
  const meta = {};
  for (const key of PROFILE_KEYS) {
    // Category arrives as a plain string; the other fields use the { value, provenance, confidence } wrapper.
    const wrapped = key === 'category' ? { value: p.category ?? null } : p[key];
    if (!wrapped || wrapped.value === null || wrapped.value === undefined) continue;
    const value = String(wrapped.value);
    fields[key] = value;
    meta[key] = {
      original: value,
      originalProvenance: wrapped.provenance || null,
      provenance: wrapped.provenance || null,
      confidence: wrapped.confidence || null,
    };
  }
  return { fields, meta, source: p.source || null };
}

function sameValue(key, a, b) {
  if (a === '' || b === '') return a === b;
  return NUMERIC_PROFILE_KEYS.includes(key) ? Number(a) === Number(b) : a === b;
}

function clearFieldError(fieldErrors, path) {
  if (!(path in fieldErrors)) return fieldErrors;
  const next = { ...fieldErrors };
  delete next[path];
  return next;
}

// Any input change makes an old result stale but keeps it for comparison.
const resetAnalysisStatus = (analysis) => ({ ...analysis, status: 'idle', error: null });

export function reducer(state, action) {
  switch (action.type) {
    case 'commodity/loadStart':
      return { ...state, commodityLoad: { status: 'loading', commodityId: action.commodityId, name: action.name, error: null } };

    case 'commodity/loadError':
      return { ...state, commodityLoad: { ...state.commodityLoad, status: 'error', error: action.error } };

    case 'commodity/loaded': {
      const p = action.payload;
      return {
        ...state,
        commodity: { commodityId: p.commodityId, commodityName: p.name, isCustom: false },
        commodityLoad: initialState.commodityLoad,
        profile: profileFromPayload(p),
        notes: null,
        analysis: initialState.analysis,
        fieldErrors: {},
        compare: null,
      };
    }

    case 'commodity/custom': {
      // A matching hardcoded preset prefills the profile; otherwise it starts blank.
      const profile = action.preset
        ? profileFromPayload(action.preset)
        : { fields: { ...EMPTY_PROFILE }, meta: {}, source: null };
      if (action.category) {
        profile.fields = { ...profile.fields, category: action.category };
        profile.meta = { ...profile.meta, category: { provenance: 'user-edited' } };
      }
      return {
        ...state,
        commodity: { commodityId: null, commodityName: action.name || '', isCustom: true },
        commodityLoad: initialState.commodityLoad,
        profile,
        notes: action.notes || null,
        analysis: initialState.analysis,
        fieldErrors: {},
        compare: null,
      };
    }

    case 'commodity/rename':
      return { ...state, commodity: { ...state.commodity, commodityName: action.name } };

    case 'profile/set': {
      const { field, value } = action;
      const m = state.profile.meta[field];
      let provenance;
      if (m && 'original' in m) provenance = sameValue(field, value, m.original) ? m.originalProvenance : 'user-edited';
      else provenance = value === '' ? null : 'user-edited';
      return {
        ...state,
        profile: {
          ...state.profile,
          fields: { ...state.profile.fields, [field]: value },
          meta: { ...state.profile.meta, [field]: { ...m, provenance } },
        },
        analysis: resetAnalysisStatus(state.analysis),
        fieldErrors: clearFieldError(state.fieldErrors, 'commodity.profile.' + field),
      };
    }

    case 'conditions/set':
      return {
        ...state,
        conditions: { ...state.conditions, [action.field]: action.value },
        analysis: resetAnalysisStatus(state.analysis),
        fieldErrors: clearFieldError(state.fieldErrors, 'conditions.' + action.field),
      };

    case 'priorities/set':
      return {
        ...state,
        priorities: { ...state.priorities, [action.field]: action.value },
        analysis: resetAnalysisStatus(state.analysis),
        fieldErrors: clearFieldError(state.fieldErrors, 'priorities.' + action.field),
      };

    case 'constraints/add': {
      const value = action.value.trim();
      if (!value || state.priorities.hardConstraints.includes(value)) return state;
      const prefix = EXCLUSIVE_CONSTRAINT_PREFIXES.find((pre) => value.startsWith(pre));
      const kept = prefix ? state.priorities.hardConstraints.filter((c) => !c.startsWith(prefix)) : state.priorities.hardConstraints;
      return {
        ...state,
        priorities: { ...state.priorities, hardConstraints: [...kept, value] },
        analysis: resetAnalysisStatus(state.analysis),
      };
    }

    case 'constraints/remove':
      return {
        ...state,
        priorities: { ...state.priorities, hardConstraints: state.priorities.hardConstraints.filter((c) => c !== action.value) },
        analysis: resetAnalysisStatus(state.analysis),
      };

    case 'analysis/start':
      return { ...state, analysis: { ...state.analysis, status: 'running', error: null }, fieldErrors: {} };

    case 'analysis/success':
      return {
        ...state,
        analysis: { status: 'success', result: action.result, payloadKey: action.payloadKey, error: null },
        compare: null,
      };

    case 'analysis/error': {
      const { error } = action;
      const fieldErrors = error.field ? { [error.field]: error.message } : {};
      return { ...state, analysis: { ...state.analysis, status: 'error', error }, fieldErrors };
    }

    case 'compare/set':
      return { ...state, compare: action.indices };

    case 'reset':
      return initialState;

    default:
      return state;
  }
}

/* ---------- Validation (client-side range checks; the backend stays authoritative) ---------- */

function checkNumber(value, { min, max }, { required = false, integer = false } = {}) {
  if (value === '' || value === null || value === undefined) return required ? 'Required' : null;
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Enter a number';
  if (integer && !Number.isInteger(n)) return 'Enter a whole number';
  if (n < min || n > max) return `Must be between ${min} and ${max}`;
  return null;
}

export function validateProfile(state) {
  const errors = {};
  if (state.commodity.isCustom && !state.commodity.commodityName.trim()) {
    errors.commodityName = 'Give your commodity a name';
  }
  for (const key of NUMERIC_PROFILE_KEYS) {
    const msg = checkNumber(state.profile.fields[key], PROFILE_FIELDS[key]);
    if (msg) errors[key] = msg;
  }
  return errors;
}

/** Range checks, plus the food's storage rule (see lib/storage.js) when one is given. */
export function validateConditions(conditions, storageRule = null) {
  const errors = { ...storageErrors(storageRule, conditions) };
  for (const key of ['storageType', 'transportMode', 'transportStress']) {
    if (!conditions[key]) errors[key] = 'Choose an option';
  }
  for (const key of NUMERIC_CONDITION_KEYS) {
    const msg = checkNumber(conditions[key], CONDITION_FIELDS[key], { required: true, integer: key === 'targetShelfLifeDays' });
    if (msg) errors[key] = errors[key] || msg;
  }
  return errors;
}

/* ---------- Derived state ---------- */

export function hasCommodity(state) {
  return state.commodity.isCustom || Boolean(state.commodity.commodityId);
}

/** Which wizard steps are complete, in order. Pass the food's storage rule to hold back unsupported storage. */
export function stepCompletion(state, storageRule = null) {
  const commodity = hasCommodity(state);
  const profile = commodity && Object.keys(validateProfile(state)).length === 0;
  const conditions = profile && Object.keys(validateConditions(state.conditions, storageRule)).length === 0;
  return { commodity, profile, conditions, priorities: conditions, result: Boolean(state.analysis.result) };
}

/** Reasons the result should carry a lower-confidence flag (spec §6.1–6.2). */
export function lowConfidence(state) {
  if (!hasCommodity(state)) return { isCustom: false, missing: [] };
  const missing = PROFILE_KEYS
    .filter((k) => state.profile.fields[k] === '')
    .map((k) => PROFILE_FIELDS[k].label);
  return { isCustom: state.commodity.isCustom, missing };
}

const toNumber = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const toEnum = (v) => (v ? v : null);

/** The POST /api/analyze request body (spec §7.3). */
export function buildAnalyzePayload(state) {
  const f = state.profile.fields;
  const c = state.conditions;
  const p = state.priorities;
  return {
    commodity: {
      commodityId: state.commodity.commodityId,
      commodityName: state.commodity.commodityName.trim(),
      isCustom: state.commodity.isCustom,
      profile: {
        moisturePct: toNumber(f.moisturePct),
        ph: toNumber(f.ph),
        fatPct: toNumber(f.fatPct),
        respirationClass: toEnum(f.respirationClass),
        oxidationSensitivity: toEnum(f.oxidationSensitivity),
        category: toEnum(f.category),
      },
    },
    conditions: {
      storageType: toEnum(c.storageType),
      temperatureC: toNumber(c.temperatureC),
      relativeHumidityPct: toNumber(c.relativeHumidityPct),
      targetShelfLifeDays: toNumber(c.targetShelfLifeDays),
      transportMode: toEnum(c.transportMode),
      transportStress: toEnum(c.transportStress),
    },
    priorities: {
      shelfLife: p.shelfLife,
      cost: p.cost,
      sustainability: p.sustainability,
      mechanicalStrength: p.mechanicalStrength,
      hardConstraints: p.hardConstraints,
    },
  };
}

/** Maps a contract field path from a VALIDATION_ERROR to the wizard step that owns it. */
export function stepForField(path) {
  if (!path) return null;
  if (path.startsWith('commodity')) return 'food';
  if (path.startsWith('conditions') || path.startsWith('priorities')) return 'journey';
  return null;
}

/** First line of a free-text description, trimmed to a short commodity name. */
export function nameFromDescription(text, max = 60) {
  const first = String(text || '').split(/[.,;:\n]/)[0].trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > 20 ? cut.slice(0, space) : cut).trim();
}
