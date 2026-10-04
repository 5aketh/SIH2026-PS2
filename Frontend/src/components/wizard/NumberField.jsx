import Field, { describedBy } from './Field';
import styles from './Field.module.css';

export default function NumberField({ id, label, value, onChange, min, max, step, unit, badge, hint, error, placeholder, className }) {
  return (
    <Field id={id} label={label} badge={badge} hint={hint} error={error} className={className}>
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
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, { hint, error })}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && <span className={styles.unit} aria-hidden="true">{unit}</span>}
      </div>
    </Field>
  );
}
