import { failureMode } from '../../data/failureModes';
import { dayRange, days, label } from '../../utils/format';
import styles from './Insights.module.css';

/**
 * Shelf life against the target, with what limits it directly underneath.
 * `highBarrier` names the barrier rated high (e.g. "oxygen"), so a failing
 * result can explain why that rating isn't helping.
 */
export default function ShelfLifeVerdict({ shelfLife, highBarrier = null }) {
  const s = shelfLife;
  if (!s || !days(s.estimateDays)) return null;
  const range = dayRange(s.lowDays, s.highDays);
  const hasTarget = typeof s.meetsTarget === 'boolean' && s.targetDays;
  const short = hasTarget && !s.meetsTarget ? Math.max(0, s.targetDays - s.estimateDays) : 0;
  const mode = failureMode(s.failureMode);

  return (
    <div className={styles.verdict} data-ok={hasTarget ? String(s.meetsTarget) : undefined}>
      <p className={styles.verdictMain}>
        <span className={styles.verdictDays}>{days(s.estimateDays)}</span>
        <span className={styles.verdictLabel}>estimated shelf life{range && <> (range {range})</>}</span>
      </p>
      {hasTarget && (
        <p className={styles.verdictTarget}>
          {s.meetsTarget
            ? <>Meets your {s.targetDays}-day target.</>
            : <>Falls short of your {s.targetDays}-day target{short >= 0.5 ? ` by about ${days(Math.round(short))}` : ''}.</>}
        </p>
      )}
      {s.failureMode && (
        <p className={styles.verdictLimit}>
          <strong>Shelf life is limited by {s.failureMode}.</strong>{' '}
          {mode?.text || `${label(s.failureMode)} is the first thing expected to go wrong in this pack.`}
        </p>
      )}
      {highBarrier && hasTarget && !s.meetsTarget && mode && !mode.barrierHelps && (
        <p className={styles.verdictNote}>
          The high {highBarrier} barrier doesn't fix this: the limit here isn't what gets through the film.
        </p>
      )}
    </div>
  );
}
