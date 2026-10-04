import Field, { describedBy } from './Field';
import styles from './Field.module.css';

/** Slider plus numeric input bound to the same value. An empty value is allowed. */
export default function RangeField({ id, label, value, onChange, min, max, step, unit, badge, hint, error, className }) {
  const empty = value === '' || value === null || value === undefined;
  return (
    <Field id={id} label={label} badge={badge} hint={hint} error={error} className={className}>
      <div className={styles.rangeRow}>
        <input
          className={styles.range}
          type="range"
          aria-label={`${label} slider`}
          min={min}
          max={max}
          step={step}
          value={empty ? min : Math.min(max, Math.max(min, Number(value) || min))}
          data-empty={empty ? '' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className={styles.numWrap}>
          <input
            id={id}
            className={styles.input}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={value}
            placeholder="—"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy(id, { hint, error })}
            onChange={(e) => onChange(e.target.value)}
          />
          {unit && <span className={styles.unit} aria-hidden="true">{unit}</span>}
        </div>
      </div>
    </Field>
  );
}
