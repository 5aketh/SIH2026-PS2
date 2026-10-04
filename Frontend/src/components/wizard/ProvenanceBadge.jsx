import { cx } from '../../utils/cx';
import styles from './Badge.module.css';

const PROVENANCE = {
  'source-backed': { label: 'Source-backed', tone: 'green', title: 'Taken from a cited data source.' },
  'rule-derived': { label: 'Rule-derived', tone: 'blue', title: 'Derived by a transparent domain rule.' },
  'model-estimated': { label: 'Model-estimated', tone: 'orange', title: 'Estimated by a trained model.' },
  'prototype-estimate': { label: 'Prototype estimate', tone: 'amber', dashed: true, title: 'Demonstration value, not validated.' },
  'user-edited': { label: 'User-edited', tone: 'neutral', title: 'Entered or changed by you.' },
};

/** Accepts either spelling from the spec ("prototype estimate" / "prototype-estimate"). */
export function normalizeProvenance(value) {
  return String(value).trim().toLowerCase().replace(/[\s_]+/g, '-');
}

/**
 * Where a value came from (build spec §3.3). Unknown values from the backend
 * are shown as-is rather than dropped.
 */
export default function ProvenanceBadge({ value, confidence, className }) {
  if (!value) return null;
  const known = PROVENANCE[normalizeProvenance(value)];
  const { label, tone, dashed, title } = known || { label: value, tone: 'neutral', title: 'Provenance reported by the analysis.' };
  const fullTitle = confidence ? `${title} Confidence: ${confidence}.` : title;
  return (
    <span className={cx(styles.badge, dashed && styles.dashed, className)} data-tone={tone} title={fullTitle}>
      <span className={styles.dot} aria-hidden="true"></span>
      <span className="sr-only">Provenance: </span>{label}
    </span>
  );
}
