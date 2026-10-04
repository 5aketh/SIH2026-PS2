import { useMemo, useState } from 'react';
import { useWizard } from '../../context/WizardContext';
import { listStructures, searchCommodities, whatIf } from '../../services/api';
import { useQuery } from '../../hooks/useQuery';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import { CONDITION_FIELDS } from '../../data/wizard';
import { FROM_ANALYSIS, conditionErrors, initialScenario, scenarioRule, storageProblem, toRequest, wizardScenario } from '../../lib/scenario';
import { useStorageRules } from '../../hooks/useStorageRules';
import { days, label } from '../../utils/format';
import Button from '../../components/Button';
import { WithTerms } from '../../components/Term';
import Notice from '../../components/wizard/Notice';
import Skeleton from '../../components/wizard/Skeleton';
import ScenarioEditor, { ConditionFields } from '../../components/tools/ScenarioEditor';
import styles from './Tools.module.css';

const RECOMMENDED = '';
const clamp = (v, key) => String(Math.min(CONDITION_FIELDS[key].max, Math.max(CONDITION_FIELDS[key].min, v)));

/** +8 °C, moving to the next storage class when that leaves the frozen (≤ −10 °C) or chilled (≤ 15 °C) range. */
function warmer(c) {
  const t = Number(c.temperatureC) + 8;
  let storageType = c.storageType;
  if (storageType === 'frozen' && t > -10) storageType = 'chilled';
  if (storageType === 'chilled' && t > 15) storageType = 'ambient';
  return { ...c, storageType, temperatureC: clamp(t, 'temperatureC') };
}

/** Quick changes to try; each starts from the baseline conditions. The first that applies is shown on load. */
const PRESETS = [
  { label: 'Cold chain lost', apply: (c) => ({ ...c, storageType: 'ambient', temperatureC: '30', transportMode: 'ambient_transport' }) },
  { label: 'Warmer storage (+8 °C)', apply: warmer },
  { label: 'Humid air (90 % RH)', apply: (c) => ({ ...c, relativeHumidityPct: '90' }) },
  { label: 'Rough transport', apply: (c) => ({ ...c, transportStress: 'high' }) },
  { label: 'Twice the shelf life', apply: (c) => ({ ...c, targetShelfLifeDays: clamp(Number(c.targetShelfLifeDays) * 2, 'targetShelfLifeDays') }) },
];

/** The first preset that changes something and is valid for the food (raw meat can't lose its cold chain, say). */
function defaultPreset(conditions, rule) {
  return PRESETS.find((p) => {
    const next = p.apply(conditions);
    return JSON.stringify(next) !== JSON.stringify(conditions) && !Object.keys(conditionErrors(next, rule)).length;
  }) || PRESETS[PRESETS.length - 1];
}

const DIRECTION = { better: '▲ Better', worse: '▼ Worse', same: '— Same' };

function show(v) {
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  return label(v) ?? '–';
}

function StructureSelect({ id, label: text, value, onChange, library, firstOption }) {
  return (
    <label className={styles.control} htmlFor={id}>
      {text}
      <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{firstOption}</option>
        {library?.map((s) => <option key={s.structureId} value={s.structureId}>{s.name}</option>)}
      </select>
    </label>
  );
}

function Results({ data }) {
  const before = data.before;
  const after = data.after;
  const rec = data.variantRecommendation;
  const samePackage = before.structure.structureId === after.structure.structureId && before.structure.name === after.structure.name;
  return (
    <>
      <section className={styles.panel} aria-labelledby="chg-title">
        <h2 className={styles.panelTitle} id="chg-title">What changes</h2>
        <p className={styles.panelSub}>
          {samePackage
            ? <>Same package: <strong>{before.structure.name}</strong></>
            : <><strong>{before.structure.name}</strong> → <strong>{after.structure.name}</strong></>}
        </p>
        <div className={`${styles.tableWrap} ${styles.gap}`}>
          <table className={styles.changes}>
            <caption className="sr-only">Indicators before and after the change</caption>
            <thead><tr><th scope="col">Indicator</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Effect</th></tr></thead>
            <tbody>
              {data.changes.map((c) => (
                <tr key={c.indicator}>
                  <th scope="row"><WithTerms text={c.indicator} /></th>
                  <td className={styles.num}>{show(c.before)}</td>
                  <td className={styles.num}>{show(c.after)}</td>
                  <td><span className={styles.dir} data-dir={c.direction}>{DIRECTION[c.direction] || c.direction}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.hint}>
          Shelf life {days(before.indicators.shelfLife.estimateDays)} → {days(after.indicators.shelfLife.estimateDays)}
          {after.indicators.shelfLife.failureMode && `, now limited by ${after.indicators.shelfLife.failureMode}`}.
          {' '}Figures are prototype estimates.
        </p>
      </section>

      {rec && (
        <div className={styles.gap}>
          <Notice tone={rec.changed ? 'warn' : 'info'} title={rec.changed ? 'PackWise would pick a different package' : 'The recommendation holds'}>
            {rec.changed
              ? <>Under the new conditions the analysis recommends <strong>{rec.structure}</strong>.</>
              : <>The analysis still recommends <strong>{rec.structure}</strong> under the new conditions.</>}
          </Notice>
        </div>
      )}
      {after.violations?.length > 0 && (
        <div className={styles.gap}>
          <Notice tone="warn" title="After the change, the analysis would rule this package out">
            <ul className={styles.violations}>{after.violations.map((v, i) => <li key={i}>{v}</li>)}</ul>
          </Notice>
        </div>
      )}
    </>
  );
}

/** What-If simulator (Features Report §3): change conditions or the package and compare. */
export default function WhatIfPage() {
  const headingRef = useFocusOnMount();
  const { state: wizard } = useWizard();
  const fromAnalysis = useMemo(() => wizardScenario(wizard), [wizard]);
  const [baseline, setBaseline] = useState(() => initialScenario(wizard));
  const [baseStructure, setBaseStructure] = useState(RECOMMENDED);
  // Until the user changes something themselves, the variant is a default preset, so the first view shows real differences.
  const [edited, setVariant] = useState(null);
  const [variantStructure, setVariantStructure] = useState('');

  const catalog = useQuery((signal) => searchCommodities('', { signal }), 'catalog');
  const structures = useQuery((signal) => listStructures({ signal }), 'structures');

  // Baseline and variant are the same food, so one rule covers both.
  const rule = scenarioRule(useStorageRules(), baseline);
  const variant = edited ?? defaultPreset(baseline.conditions, rule).apply(baseline.conditions);

  function changeBaseline(next) {
    // Baseline edits flow into the user's own variant, except for fields they changed there.
    const prev = baseline.conditions;
    if (edited) setVariant(Object.fromEntries(Object.entries(next.conditions).map(([k, val]) => [k, edited[k] === prev[k] ? val : edited[k]])));
    setBaseline(next);
  }

  const baseProblem = storageProblem(rule, baseline.conditions);
  const varProblem = storageProblem(rule, variant);
  const baseReq = toRequest(baseline, baseline.conditions, rule);
  const varReq = toRequest(baseline, variant, rule);
  const conditionsChanged = JSON.stringify(variant) !== JSON.stringify(baseline.conditions);
  const payload = baseReq && varReq ? {
    baseline: { scenario: baseReq, structure: baseStructure ? { structureId: baseStructure } : null },
    variant: {
      scenario: conditionsChanged ? varReq : null,
      structure: variantStructure ? { structureId: variantStructure } : null,
    },
  } : null;
  const nothingChanged = !conditionsChanged && !variantStructure;
  const result = useQuery((signal) => whatIf(payload, { signal }), payload ? JSON.stringify(payload) : null, { delay: 350 });

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>What-If Simulator</p>
        <h1 className={styles.title} tabIndex={-1} ref={headingRef}>What if conditions change?</h1>
        <p className={styles.sub}>
          Set a baseline, then change the storage, transport or package and see the effect on shelf life, cost,
          barrier and footprint, indicator by indicator.
        </p>
      </header>

      <div className={styles.workspace}>
        <div className={styles.sticky}>
          <section className={styles.panel} aria-labelledby="base-title">
            <h2 className={styles.panelTitle} id="base-title">Baseline</h2>
            <p className={styles.panelSub}>{baseline.commodityKey === FROM_ANALYSIS ? 'From your analysis.' : 'The situation today.'}</p>
            <div className={styles.gap}>
              <ScenarioEditor idPrefix="base" scenario={baseline} onChange={changeBaseline} catalog={catalog.data?.results} fromAnalysis={fromAnalysis} rule={rule} />
            </div>
            <div className={styles.gap}>
              <StructureSelect id="base-structure" label="Package" value={baseStructure} onChange={setBaseStructure}
                library={structures.data?.results} firstOption="PackWise's recommendation for the baseline" />
            </div>
          </section>

          <section className={`${styles.panel} ${styles.gap}`} aria-labelledby="var-title">
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle} id="var-title">The change</h2>
                <p className={styles.panelSub}>Edit any value, or try a preset.</p>
              </div>
              {!nothingChanged && (
                <Button size="sm" variant="ghost" onClick={() => { setVariant({ ...baseline.conditions }); setVariantStructure(''); }}>Reset</Button>
              )}
            </div>
            <div className={styles.chips} role="group" aria-label="Presets">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className={styles.chip}
                  aria-pressed={JSON.stringify(p.apply(baseline.conditions)) === JSON.stringify(variant)}
                  onClick={() => setVariant(p.apply(baseline.conditions))}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className={styles.gap}>
              <ConditionFields idPrefix="var" conditions={variant} onChange={setVariant} compareTo={baseline.conditions} rule={rule} />
            </div>
            <div className={styles.gap}>
              <StructureSelect id="var-structure" label="Package" value={variantStructure} onChange={setVariantStructure}
                library={structures.data?.results} firstOption="Same package as the baseline" />
            </div>
          </section>
        </div>

        <div>
          <p className={styles.status} role="status" aria-live="polite">
            {result.status === 'loading' && payload ? 'Comparing…' : !payload && !baseProblem && !varProblem ? 'Fix the highlighted values to compare.' : ''}
          </p>
          {(baseProblem || varProblem) && (
            <Notice tone="warn" title={baseProblem ? "The baseline isn't supported for this food" : "The change isn't supported for this food"}>
              {baseProblem || varProblem} {baseProblem ? 'Change the baseline storage to compare.' : 'Pick another change to compare.'}
            </Notice>
          )}
          {nothingChanged && payload && (
            <div className={styles.gap}>
              <Notice tone="info" title="Change something to compare">Pick a preset or edit a value on the left. Until then, before and after are the same.</Notice>
            </div>
          )}
          {result.status === 'error' && (
            <div className={styles.gap}>
              <Notice tone={result.error?.code === 'NOT_AVAILABLE' ? 'info' : 'danger'}
                title={result.error?.code === 'NOT_AVAILABLE' ? 'Needs the backend' : "Couldn't run the comparison"}
                actions={result.error?.code !== 'NOT_AVAILABLE' && <Button size="sm" variant="ghost" onClick={result.retry}>Try again</Button>}>
                {result.error?.message}
              </Notice>
            </div>
          )}
          {!result.data && result.status === 'loading' && <div className={`${styles.panel} ${styles.gap}`}><Skeleton height={300} /></div>}
          {result.data && payload && (
            <div className={`${styles.gap} ${result.status === 'loading' ? styles.busy : ''}`}>
              <Results data={result.data} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
