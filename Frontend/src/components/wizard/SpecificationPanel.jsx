import { num } from '../../utils/format';
import { WithTerms } from '../Term';
import LayerStack from './LayerStack';
import ProvenanceBadge from './ProvenanceBadge';
import resultStyles from './Result.module.css';
import styles from './Insights.module.css';

function transmission(t) {
  if (!t || typeof t.candidate !== 'number') return null;
  return (
    <>
      {num(t.candidate, t.unit)}
      {typeof t.targetMax === 'number' && <> (max {num(t.targetMax)})</>}
      {t.testConditions && <small>Tested at {t.testConditions}</small>}
    </>
  );
}

/** Converter-facing specification of a structure: layers and test targets. */
export default function SpecificationPanel({ spec, title = 'Specification' }) {
  if (!spec) return null;
  const perf = spec.perforation;
  const rows = [
    ['Total gauge', num(spec.totalGaugeUm, 'µm')],
    ['Oxygen transmission (OTR)', transmission(spec.otr)],
    ['Water vapour transmission (WVTR)', transmission(spec.wvtr)],
    ['Mechanical index', typeof spec.mechanicalIndex === 'number' ? `${spec.mechanicalIndex} / 100` : null],
    ['Gelbo flex pinholes', num(spec.gelboPinholes)],
    ['Perforation', perf?.required ? `${perf.holesPerPack} × ${num(perf.diameterUm, 'µm')} (${perf.standard || perf.type})` : null],
    ['Gas flush (MAP)', spec.mapFlush?.label || null],
    ['Seal strength', spec.sealStrength?.target || null],
    ['Food-contact standards', spec.compliance?.foodContactStandards?.join(', ') || null],
    ['Migration test simulant', spec.compliance?.migrationSimulant || null],
  ].filter(([, v]) => v);

  return (
    <section className={resultStyles.panel} aria-labelledby="spec-title">
      <div className={styles.head}>
        <div>
          <h2 className={resultStyles.panelTitle} id="spec-title">{title}</h2>
          <p className={resultStyles.panelSub}>Layers and test targets to hand to a converter.</p>
        </div>
        <ProvenanceBadge value="prototype estimate" />
      </div>
      <LayerStack layers={spec.layers} />
      {rows.length > 0 && (
        <dl className={styles.specs}>
          {rows.map(([k, v]) => (
            <div key={k}><dt><WithTerms text={k} /></dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}
