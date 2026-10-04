import styles from './Result.module.css';
import Term from '../Term';

const NOT_AVAILABLE = 'Not available for this scenario';

function show(v) {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
}

/**
 * Fresh Produce / MAP branch (spec §6.6). Gas-composition targets are shown
 * only when the payload has them; a configTemplate renders as a template,
 * never as asserted numbers.
 */
export default function FreshProducePanel({ data }) {
  const template = data?.configTemplate;
  const mapLabel = data?.mapSuitable === true ? 'Suitable' : data?.mapSuitable === false ? 'Not suitable' : null;
  return (
    <section className={styles.panel} aria-labelledby="fresh-title" data-cat="produce">
      <h2 className={styles.panelTitle} id="fresh-title">
        <span className={styles.freshDot} aria-hidden="true"></span>Fresh produce / MAP
      </h2>
      <p className={styles.panelSub}>This food keeps respiring after harvest, so gas exchange was analysed.</p>
      <dl className={styles.facts}>
        <div>
          <dt>Gas exchange requirement</dt>
          <dd>{show(data?.gasExchangeRequirement) ?? <span className={styles.na}>{NOT_AVAILABLE}</span>}</dd>
        </div>
        <div>
          <dt><Term term="MAP" /> suitability</dt>
          <dd>
            {mapLabel
              ? <span className={styles.mapFlag} data-ok={data.mapSuitable ? '' : undefined}>{mapLabel}</span>
              : <span className={styles.na}>{NOT_AVAILABLE}</span>}
          </dd>
        </div>
      </dl>

      <div className={styles.template}>
        <p className={styles.templateTitle}>Gas composition: configuration template</p>
        {template ? (
          <>
            {template.note && <p className={styles.templateNote}>{template.note}</p>}
            <dl className={styles.facts}>
              <div>
                <dt>O₂ target</dt>
                <dd>{show(template.o2Target) ?? <span className={styles.slot}>not validated</span>}</dd>
              </div>
              <div>
                <dt>CO₂ target</dt>
                <dd>{show(template.co2Target) ?? <span className={styles.slot}>not validated</span>}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className={styles.na}>{NOT_AVAILABLE}</p>
        )}
      </div>
    </section>
  );
}
