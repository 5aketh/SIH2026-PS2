import { inr, label, num } from '../../utils/format';
import Term from '../Term';
import ConfidenceBadge from './ConfidenceBadge';
import ProvenanceBadge from './ProvenanceBadge';
import ShelfLifeVerdict from './ShelfLifeVerdict';
import resultStyles from './Result.module.css';
import styles from './Insights.module.css';

/**
 * The result's headline: shelf life against the target (with what limits it),
 * cost and confidence, and what the numbers rest on. Confidence and provenance
 * stay visible here rather than behind "Why this?".
 */
export default function ResultSummary({ result }) {
  const s = result.shelfLife;
  const c = result.costAndImpact || {};
  const confidence = result.confidence || {};
  const level = confidence.level || result.recommendation?.confidence;
  return (
    <section className={resultStyles.panel} aria-labelledby="summary-title">
      <div className={styles.head}>
        <h2 className={resultStyles.panelTitle} id="summary-title">At a glance</h2>
        <ProvenanceBadge value={s?.provenance || c.provenance} />
      </div>
      <ShelfLifeVerdict shelfLife={s} />
      <dl className={styles.figures}>
        {inr(c.inrPerPack) && (
          <div className={styles.figure}>
            <dt>Packaging cost</dt>
            <dd>
              <span className={styles.value}>{inr(c.inrPerPack)}</span>
              <span className={styles.detail}>per pack{c.costBand && <> · {label(c.costBand).toLowerCase()} <Term term="cost band" /></>}</span>
            </dd>
          </div>
        )}
        {level && (
          <div className={styles.figure}>
            <dt>Confidence</dt>
            <dd>
              <span className={styles.value}><ConfidenceBadge value={level} showKey={false} /></span>
              <span className={styles.detail}>{level === 'prototype' ? 'Estimates, not lab measurements' : 'Catalog data with prototype engine estimates'}</span>
            </dd>
          </div>
        )}
        {num(c.gCo2ePerPack) && (
          <div className={styles.figure}>
            <dt>Footprint</dt>
            <dd>
              <span className={styles.value}>{num(c.gCo2ePerPack, 'g CO₂e')}</span>
              <span className={styles.detail}>{typeof c.recyclable === 'boolean' && (c.recyclable ? 'Recyclable' : 'Hard to recycle')}</span>
            </dd>
          </div>
        )}
      </dl>
      {confidence.reasons?.length > 0 && (
        <div className={styles.restsOn}>
          <h3 className={styles.subhead}>What this rests on</h3>
          <ul className={styles.list}>{confidence.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
