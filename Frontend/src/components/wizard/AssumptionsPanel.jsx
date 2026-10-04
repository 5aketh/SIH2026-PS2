import { label } from '../../utils/format';
import resultStyles from './Result.module.css';
import styles from './Insights.module.css';

/** What the confidence rests on, the assumptions made, and the candidates ruled out ("Why not this?"). */
export default function AssumptionsPanel({ confidence, assumptions, rejected, openRejected = false }) {
  const reasons = confidence?.reasons || [];
  if (!reasons.length && !assumptions?.length && !rejected?.length) return null;
  return (
    <section className={resultStyles.panel} aria-labelledby="assume-title">
      <h2 className={resultStyles.panelTitle} id="assume-title">Confidence and assumptions</h2>
      <p className={resultStyles.panelSub}>What this result rests on. Check these before treating it as a specification.</p>
      {reasons.length > 0 && (
        <>
          <h3 className={styles.subhead}>Confidence{confidence.level ? `: ${label(confidence.level)}` : ''}</h3>
          <ul className={styles.list}>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </>
      )}
      {assumptions?.length > 0 && (
        <>
          <h3 className={styles.subhead}>Assumptions</h3>
          <ul className={styles.list}>{assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </>
      )}
      {rejected?.length > 0 && (
        <details className={styles.details} open={openRejected}>
          <summary>Why not the others? {rejected.length} candidates ruled out</summary>
          <ul className={styles.ruled}>
            {rejected.map((r) => (
              <li key={r.structureId || r.structure}>
                <span className={styles.ruledName}>{r.structure}</span>
                {r.stage && <span className={styles.ruledStage}>{label(r.stage.replace(/-/g, ' '))}</span>}
                <p className={styles.ruledReason}>{(r.reasons || []).join(' ')}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
