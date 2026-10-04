import { useState } from 'react';
import { useWizard } from '../../context/WizardContext';
import { CONSTRAINT_SUGGESTIONS, PRIORITY_FIELDS, constraintLabel, excludeMaterial, maxGauge } from '../../data/wizard';
import { listMaterials } from '../../services/api';
import { useQuery } from '../../hooks/useQuery';
import Button from '../../components/Button';
import TagChip from '../../components/TagChip';
import LockIcon from '../../components/icons/LockIcon';
import ScaleIcon from '../../components/icons/ScaleIcon';
import fieldStyles from '../../components/wizard/Field.module.css';
import styles from './Wizard.module.css';
import own from './PrioritiesSection.module.css';

const WEIGHT_WORDS = ['Ignore', 'Very low', 'Low', 'Low', 'Moderate', 'Moderate', 'Moderate', 'High', 'High', 'Very high', 'Critical'];

/** Priority weights and hard constraints on the Journey step. */
export default function PrioritiesSection() {
  const { state, dispatch } = useWizard();
  const [material, setMaterial] = useState('');
  const [gauge, setGauge] = useState('');
  const materials = useQuery((signal) => listMaterials({}, { signal }), 'materials').data?.results || [];
  const materialNames = Object.fromEntries(materials.map((m) => [m.materialId, m.name]));

  const p = state.priorities;
  const total = PRIORITY_FIELDS.reduce((sum, f) => sum + p[f.key], 0);
  const constraints = p.hardConstraints;
  const suggested = new Set(CONSTRAINT_SUGGESTIONS.map((s) => s.value));
  const extraConstraints = constraints.filter((c) => !suggested.has(c));

  function toggleSuggestion(value) {
    dispatch({ type: constraints.includes(value) ? 'constraints/remove' : 'constraints/add', value });
  }

  function add(value) {
    dispatch({ type: 'constraints/add', value });
  }

  const gaugeOk = Number(gauge) > 0 && Number(gauge) <= 1000;

  return (
    <>
      <section className={`${styles.panel} ${styles.section}`} aria-labelledby="weights-title">
        <div className={styles.panelHead}>
          <span className={styles.panelIcon} aria-hidden="true"><ScaleIcon /></span>
          <div>
            <h2 className={styles.panelTitle} id="weights-title">What matters most?</h2>
            <p className={styles.panelSub}>
              Candidates that pass the requirements are ranked with these weights. 0 ignores a priority, 1 makes it as important as possible.
            </p>
          </div>
        </div>

        <div className={own.sliders}>
          {PRIORITY_FIELDS.map((f) => {
            const v = p[f.key];
            return (
              <div key={f.key} className={own.slider} style={{ '--c': f.color }}>
                <div className={own.sliderHead}>
                  <label htmlFor={'prio-' + f.key} className={own.sliderLabel}>
                    <span className={own.swatch} aria-hidden="true"></span>{f.label}
                  </label>
                  <output htmlFor={'prio-' + f.key} className={own.value}>
                    {v.toFixed(1)} <span>{WEIGHT_WORDS[Math.round(v * 10)]}</span>
                  </output>
                </div>
                <input
                  id={'prio-' + f.key}
                  className={own.range}
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={v}
                  aria-describedby={'prio-' + f.key + '-hint'}
                  aria-valuetext={`${v.toFixed(1)}, ${WEIGHT_WORDS[Math.round(v * 10)]}`}
                  onChange={(e) => dispatch({ type: 'priorities/set', field: f.key, value: Number(e.target.value) })}
                />
                <p className={own.hint} id={'prio-' + f.key + '-hint'}>{f.hint}</p>
              </div>
            );
          })}
        </div>

        <div className={own.emphasis}>
          <p className={own.emphasisLabel}>Relative emphasis</p>
          {total > 0 ? (
            <>
              <div className={own.bar} role="img" aria-label={PRIORITY_FIELDS.map((f) => `${f.label} ${Math.round((p[f.key] / total) * 100)}%`).join(', ')}>
                {PRIORITY_FIELDS.map((f) => (
                  <span key={f.key} style={{ flexGrow: p[f.key], background: f.color }}></span>
                ))}
              </div>
              <ul className={own.legend} aria-hidden="true">
                {PRIORITY_FIELDS.map((f) => (
                  <li key={f.key} style={{ '--c': f.color }}>
                    <span className={own.swatch}></span>{f.label} {Math.round((p[f.key] / total) * 100)}%
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={own.none}>No priority has any weight yet.</p>
          )}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="constraints-title">
        <div className={styles.panelHead}>
          <span className={styles.panelIcon} aria-hidden="true"><LockIcon /></span>
          <div>
            <h2 className={styles.panelTitle} id="constraints-title">Hard constraints <span className={own.optional}>(optional)</span></h2>
            <p className={styles.panelSub}>Candidates that break any of these are filtered out rather than ranked lower.</p>
          </div>
        </div>
        <div className={own.chips} role="group" aria-label="Suggested constraints">
          {CONSTRAINT_SUGGESTIONS.map((s) => (
            <TagChip key={s.value} tag={s.label} pressed={constraints.includes(s.value)} onSelect={() => toggleSuggestion(s.value)} />
          ))}
        </div>

        <div className={own.addRows}>
          <form className={own.addRow} onSubmit={(e) => { e.preventDefault(); if (material) { add(excludeMaterial(material)); setMaterial(''); } }}>
            <label htmlFor="constraint-material" className={own.addLabel}>Exclude a material</label>
            <select id="constraint-material" className={fieldStyles.input} value={material} onChange={(e) => setMaterial(e.target.value)}>
              <option value="">Choose a material…</option>
              {materials.map((m) => <option key={m.materialId} value={m.materialId}>{m.name}</option>)}
            </select>
            <Button type="submit" variant="ghost" disabled={!material}>Exclude</Button>
          </form>
          <form className={own.addRow} onSubmit={(e) => { e.preventDefault(); if (gaugeOk) { add(maxGauge(Number(gauge))); setGauge(''); } }}>
            <label htmlFor="constraint-gauge" className={own.addLabel}>Maximum thickness (µm)</label>
            <input id="constraint-gauge" className={fieldStyles.input} type="number" inputMode="numeric" min="1" max="1000" step="1"
              placeholder="e.g. 80" value={gauge} onChange={(e) => setGauge(e.target.value)} />
            <Button type="submit" variant="ghost" disabled={!gaugeOk}>Set limit</Button>
          </form>
        </div>

        {extraConstraints.length > 0 && (
          <ul className={own.extra} aria-label="Your other constraints">
            {extraConstraints.map((c) => {
              const text = constraintLabel(c, materialNames);
              return (
                <li key={c}>
                  {text}
                  <button type="button" className={own.remove} onClick={() => dispatch({ type: 'constraints/remove', value: c })} aria-label={`Remove: ${text}`}>×</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
