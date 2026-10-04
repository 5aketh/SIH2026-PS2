import { label } from '../../utils/format';
import resultStyles from './Result.module.css';
import styles from './Insights.module.css';

/** Deterioration and damage risks the backend assessed, in the order returned. */
export default function RisksPanel({ risks }) {
  if (!risks?.length) return null;
  return (
    <section className={resultStyles.panel} aria-labelledby="risks-title">
      <h2 className={resultStyles.panelTitle} id="risks-title">Risks</h2>
      <p className={resultStyles.panelSub}>What could go wrong for this food under these conditions, and why.</p>
      <ul className={styles.risks}>
        {risks.map((r) => (
          <li key={r.code || r.title} className={styles.risk} data-level={r.level}>
            <span className={styles.riskTitle}>{r.title}</span>
            <span className={styles.riskLevel}>{label(r.level)}<span className="sr-only"> risk</span></span>
            {r.drivers?.length > 0 && <span className={styles.riskDrivers}>{r.drivers.join(' · ')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
