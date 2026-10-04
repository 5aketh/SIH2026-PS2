import { inr, label, num } from '../../utils/format';
import Term from '../Term';
import ProvenanceBadge from './ProvenanceBadge';
import ShelfLifeVerdict from './ShelfLifeVerdict';
import resultStyles from './Result.module.css';
import styles from './Insights.module.css';

/** Shelf life against the target, cost, footprint and end of life for one structure. */
export default function KeyFigures({ shelfLife, costAndImpact, title = 'At a glance', sub = 'Estimated performance of the recommended structure, per pack.' }) {
  if (!shelfLife && !costAndImpact) return null;
  const s = shelfLife || {};
  const c = costAndImpact || {};

  return (
    <section className={resultStyles.panel} aria-labelledby="figures-title">
      <div className={styles.head}>
        <div>
          <h2 className={resultStyles.panelTitle} id="figures-title">{title}</h2>
          <p className={resultStyles.panelSub}>{sub}</p>
        </div>
        <ProvenanceBadge value={s.provenance || c.provenance} />
      </div>
      <ShelfLifeVerdict shelfLife={shelfLife} />
      <dl className={styles.figures}>
        {inr(c.inrPerPack) && (
          <div className={styles.figure}>
            <dt>Packaging cost</dt>
            <dd>
              <span className={styles.value}>{inr(c.inrPerPack)}</span>
              <span className={styles.detail}>
                {c.costBand && <>{label(c.costBand)} <Term term="cost band" /></>}
                {inr(c.eprFeeInrPerPack) && <> · <Term term="EPR" /> fee {inr(c.eprFeeInrPerPack)}</>}
              </span>
            </dd>
          </div>
        )}
        {num(c.gCo2ePerPack) && (
          <div className={styles.figure}>
            <dt>Carbon footprint</dt>
            <dd>
              <span className={styles.value}>{num(c.gCo2ePerPack, 'g CO₂e')}</span>
              {num(c.gramsPerPack) && <span className={styles.detail}>{num(c.gramsPerPack, 'g')} of film per pack</span>}
            </dd>
          </div>
        )}
        {typeof c.recyclable === 'boolean' && (
          <div className={styles.figure}>
            <dt>End of life</dt>
            <dd>
              <span className={styles.value}>{c.recyclable ? 'Recyclable' : 'Hard to recycle'}</span>
              <span className={styles.detail}>
                {c.monoMaterial ? <Term term="Mono-material" /> : 'Multi-material'}
                {num(c.recyclabilityIndex) && <> · index {c.recyclabilityIndex}/100</>}
                {c.eprCategory && <> · <Term term="EPR" /> category {c.eprCategory}</>}
              </span>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
