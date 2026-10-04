import { cx } from '../../utils/cx';
import styles from './Field.module.css';

/** Single-choice radio group styled as chips (fast entry, not a dropdown). */
export default function ChoiceGroup({ name, legend, options, value, onChange, badge, hint, error, className }) {
  const describedBy = [hint && name + '-hint', error && name + '-error'].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className={cx(styles.field, className)} aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined}>
      <legend className={styles.legend}>
        <span className={styles.label}>{legend}</span>
        {badge}
      </legend>
      <div className={styles.choices}>
        {options.map((o) => (
          <label key={o.value} className={styles.choice}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className={styles.check} aria-hidden="true">✓</span>
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className={styles.hint} id={name + '-hint'}>{hint}</p>}
      {error && <p className={styles.error} id={name + '-error'}>{error}</p>}
    </fieldset>
  );
}
