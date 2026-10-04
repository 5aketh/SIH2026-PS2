import { cx } from '../../utils/cx';
import styles from './Field.module.css';

/**
 * Label row (label + optional provenance badge), control, hint and error.
 * The control should use `describedBy(id)` for aria-describedby.
 */
export default function Field({ id, label, unit, badge, hint, error, className, children }) {
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}{unit && <span className={styles.unitHint}> ({unit})</span>}
        </label>
        {badge}
      </div>
      {children}
      {hint && <p className={styles.hint} id={id + '-hint'}>{hint}</p>}
      {error && <p className={styles.error} id={id + '-error'}>{error}</p>}
    </div>
  );
}

export function describedBy(id, { hint, error }) {
  return [hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ') || undefined;
}
