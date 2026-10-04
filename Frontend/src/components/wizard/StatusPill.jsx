import { cx } from '../../utils/cx';
import styles from './Badge.module.css';

const STATUS = {
  PASS: { tone: 'green', glyph: '✓' },
  REVIEW: { tone: 'amber', glyph: '!' },
};

/** Candidate performance against one requirement. */
export default function StatusPill({ status, className }) {
  if (!status) return null;
  const { tone, glyph } = STATUS[String(status).toUpperCase()] || { tone: 'neutral', glyph: null };
  return (
    <span className={cx(styles.badge, styles.status, className)} data-tone={tone}>
      {glyph && <span className={styles.glyph} aria-hidden="true">{glyph}</span>}
      {status}
    </span>
  );
}
