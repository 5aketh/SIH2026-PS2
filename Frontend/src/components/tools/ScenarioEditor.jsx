import { CONDITION_FIELDS, STORAGE_TYPES, TRANSPORT_MODES, TRANSPORT_STRESS } from '../../data/wizard';
import { FROM_ANALYSIS, catalogScenario, conditionErrors } from '../../lib/scenario';
import { storageHint } from '../../lib/storage';
import styles from '../../pages/tools/Tools.module.css';

const SELECTS = { storageType: STORAGE_TYPES, transportMode: TRANSPORT_MODES, transportStress: TRANSPORT_STRESS };
const ORDER = ['storageType', 'temperatureC', 'relativeHumidityPct', 'targetShelfLifeDays', 'transportMode', 'transportStress'];

/** Storage and transport condition inputs (strings while editing). */
export function ConditionFields({ idPrefix, conditions, onChange, compareTo, rule }) {
  const errors = conditionErrors(conditions, rule);
  const set = (key, value) => onChange({ ...conditions, [key]: value });
  return (
    <div className={styles.fieldGrid}>
      {ORDER.map((key) => {
        const f = CONDITION_FIELDS[key];
        const id = `${idPrefix}-${key}`;
        const changed = compareTo && String(compareTo[key]) !== String(conditions[key]);
        return (
          <label key={key} className={styles.control} htmlFor={id}>
            <span>{f.label}{f.unit ? ` (${f.unit})` : ''}{changed && <strong className={styles.warn}> · changed</strong>}</span>
            {SELECTS[key] ? (
              <select id={id} className={styles.select} value={conditions[key]} onChange={(e) => set(key, e.target.value)}>
                {SELECTS[key].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input id={id} className={styles.input} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step}
                value={conditions[key]} aria-invalid={errors[key] ? 'true' : undefined}
                onChange={(e) => set(key, e.target.value)} />
            )}
            {errors[key] && <span className={styles.warn} role="alert">{errors[key]}</span>}
          </label>
        );
      })}
    </div>
  );
}

/** Food choice (catalog or the wizard's own) plus conditions. */
export default function ScenarioEditor({ idPrefix = 'scn', scenario, onChange, catalog, fromAnalysis, rule }) {
  function pickFood(key) {
    if (key === FROM_ANALYSIS && fromAnalysis) {
      onChange({ ...fromAnalysis, conditions: scenario.conditions });
      return;
    }
    const hit = catalog?.find((c) => c.commodityId === key);
    if (hit) onChange(catalogScenario({ commodityId: hit.commodityId, name: hit.name }, scenario.conditions));
  }

  const foodId = `${idPrefix}-food`;
  return (
    <div className={styles.fieldGrid}>
      <label className={`${styles.control} ${styles.wide}`} htmlFor={foodId}>
        Food
        <select id={foodId} className={styles.select} value={scenario.commodityKey} onChange={(e) => pickFood(e.target.value)}>
          {fromAnalysis && (
            <option value={FROM_ANALYSIS}>{fromAnalysis.commodity.commodityName || 'Custom food'} (your analysis profile)</option>
          )}
          {!catalog && scenario.commodityKey !== FROM_ANALYSIS && (
            <option value={scenario.commodityKey}>{scenario.commodity.commodityName}</option>
          )}
          {catalog?.map((c) => <option key={c.commodityId} value={c.commodityId}>{c.name}</option>)}
        </select>
        {storageHint(rule) && <span className={styles.hint}>{storageHint(rule)}</span>}
      </label>
      <div className={styles.wide}>
        <ConditionFields idPrefix={idPrefix} conditions={scenario.conditions} rule={rule}
          onChange={(conditions) => onChange({ ...scenario, conditions })} />
      </div>
    </div>
  );
}
