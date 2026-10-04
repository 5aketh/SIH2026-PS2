import { cx } from '../../utils/cx';
import styles from './Badge.module.css';

const CONFIDENCE = {
  prototype: { label: 'Prototype', tone: 'amber', dashed: true },
  medium: { label: 'Medium', tone: 'blue' },
  high: { label: 'High', tone: 'green' },
};

/** Overall confidence of a result, exactly as the payload states it. */
export default function ConfidenceBadge({ value, className, showKey = true }) {
  if (!value) return null;
  const { label, tone, dashed } = CONFIDENCE[String(value).toLowerCase()] || { label: value, tone: 'neutral' };
  return (
    <span className={cx(styles.badge, dashed && styles.dashed, className)} data-tone={tone}>
      {showKey && <span className={styles.key}>Confidence</span>}{label}
    </span>
  );
}
