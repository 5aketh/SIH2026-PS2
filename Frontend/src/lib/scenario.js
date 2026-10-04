/*
 * Scenario state for the Builder and What-If simulator: a food plus storage and
 * transport conditions, turned into the same body POST /api/analyze takes.
 * Conditions are kept as strings while editing, like the wizard's.
 */
import { buildAnalyzePayload, stepCompletion, validateConditions } from './wizardModel';
import { storageErrors, storageRuleFor } from './storage';

export const DEFAULT_CONDITIONS = {
  storageType: 'chilled', temperatureC: '12', relativeHumidityPct: '85', targetShelfLifeDays: '20',
  transportMode: 'refrigerated_transport', transportStress: 'medium',
};
const DEFAULT_PRIORITIES = { shelfLife: 0.5, cost: 0.5, sustainability: 0.5, mechanicalStrength: 0.5, hardConstraints: [] };

export const FROM_ANALYSIS = '__analysis__';

/**
 * The wizard's food and conditions, when they're complete enough to analyse.
 * Storage rules aren't applied here on purpose: an unsupported state carries
 * over visibly, flagged in the editor, instead of being silently replaced.
 */
export function wizardScenario(state) {
  if (!stepCompletion(state).conditions) return null;
  const payload = buildAnalyzePayload(state);
  return {
    commodityKey: FROM_ANALYSIS,
    commodity: payload.commodity,
    conditions: { ...state.conditions },
    priorities: payload.priorities,
  };
}

export function catalogScenario({ commodityId, name }, conditions = DEFAULT_CONDITIONS) {
  return {
    commodityKey: commodityId,
    // An empty profile makes the backend use the catalog record's own values.
    commodity: { commodityId, commodityName: name, isCustom: false, profile: {} },
    conditions: { ...conditions },
    priorities: DEFAULT_PRIORITIES,
  };
}

export function initialScenario(wizardState) {
  return wizardScenario(wizardState) || catalogScenario({ commodityId: 'TOMATO_GENERIC', name: 'Tomato' });
}

/** The storage rule for a scenario's food (see lib/storage.js). */
export function scenarioRule(rules, scenario) {
  const c = scenario.commodity;
  return storageRuleFor(rules, { commodityId: c.commodityId, name: c.commodityName, category: c.profile?.category });
}

/** The message explaining why these conditions can't be used for the food, if any. */
export function storageProblem(rule, conditions) {
  return Object.values(storageErrors(rule, conditions))[0] || null;
}

export function conditionErrors(conditions, rule) {
  return validateConditions(conditions, rule);
}

/** The analyze-request body, or null while a condition is invalid or unsupported for the food. */
export function toRequest(scenario, conditions = scenario.conditions, rule = null) {
  if (Object.keys(validateConditions(conditions, rule)).length) return null;
  return {
    commodity: scenario.commodity,
    conditions: {
      ...conditions,
      temperatureC: Number(conditions.temperatureC),
      relativeHumidityPct: Number(conditions.relativeHumidityPct),
      targetShelfLifeDays: Number(conditions.targetShelfLifeDays),
    },
    priorities: scenario.priorities,
  };
}
