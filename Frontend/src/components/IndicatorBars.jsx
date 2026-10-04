import { cx } from '../utils/cx';
import styles from '../pages/tools/Tools.module.css';

/** Shown wherever a film's sealability is "none" (score 0). */
export const NO_SEAL_NOTE = "Can't be heat-sealed on its own, so it needs a sealant layer (such as PE or CPP) on the food side.";

export const MATERIAL_INDICATORS = [
  ['oxygenBarrier', 'Oxygen barrier'],
  ['moistureBarrier', 'Moisture barrier'],
  ['mechanicalStrength', 'Strength'],
  ['sealability', 'Sealability'],
  ['sustainability', 'Sustainability'],
];

/** 0–100 indicator scores from the knowledge base as labelled bars. */
export default function IndicatorBars({ values, large = false }) {
  if (!values) return null;
  return (
    <dl className={cx(styles.bars, large && styles.barsLg)}>
      {MATERIAL_INDICATORS.map(([key, label]) => {
        const v = values[key];
        if (typeof v !== 'number') return null;
        return (
          <div key={key} className={styles.bar}>
            <dt>{label}</dt>
            <dd>
              <span className={styles.track} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
                <span className={styles.fill} style={{ '--v': v }}></span>
              </span>
              <span className={styles.barValue}>{v}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
