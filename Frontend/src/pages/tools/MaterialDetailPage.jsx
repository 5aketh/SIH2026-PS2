import { Link, useParams } from 'react-router';
import { getMaterial } from '../../services/api';
import { useQuery } from '../../hooks/useQuery';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import { label, num } from '../../utils/format';
import Button from '../../components/Button';
import { WithTerms } from '../../components/Term';
import IndicatorBars, { NO_SEAL_NOTE } from '../../components/IndicatorBars';
import Notice from '../../components/wizard/Notice';
import ProvenanceBadge from '../../components/wizard/ProvenanceBadge';
import Skeleton from '../../components/wizard/Skeleton';
import styles from './Tools.module.css';

const yesNo = (v) => (v ? 'Yes' : 'No');
const range = (r, unit) => (Array.isArray(r) ? `${r[0]}–${r[1]}${unit ? ` ${unit}` : ''}` : null);

function Transmission({ t }) {
  if (!t) return null;
  return <>{num(t.value, t.unit)}<small>At {t.conditions} <ProvenanceBadge value={t.provenance} /></small></>;
}

function Detail({ m }) {
  const p = m.properties;
  const rows = [
    ['Oxygen transmission (OTR)', <Transmission t={p.otr} />],
    ['Water vapour transmission (WVTR)', <Transmission t={p.wvtr} />],
    ['Reference thickness', num(p.referenceThicknessUm, 'µm')],
    ['Density', num(p.densityGcm3, 'g/cm³')],
    ['Sealability', p.sealability === 'none' ? <>None<small>{NO_SEAL_NOTE}</small></> : label(p.sealability)],
    ['Seal range', range(p.sealRangeC, '°C')],
    ['Gelbo flex pinholes', range(p.gelboPinholes)],
    ['Light barrier', label(p.lightBarrier)],
    ['Cost', range(p.costInrPerKg, '₹/kg')],
    ['Carbon footprint', num(p.carbonKgCo2ePerKg, 'kg CO₂e/kg')],
    ['EPR category', p.eprCategory],
    ['Compostable', yesNo(p.compostable)],
    ['Metallised', yesNo(p.metallised)],
    ['Barrier drops in humidity', yesNo(p.humiditySensitive)],
    ['Seals through contamination', yesNo(p.contaminationTolerantSeal)],
  ].filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className={`${styles.detailGrid} ${styles.gapLg}`}>
      <section className={styles.panel} aria-labelledby="props-title">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle} id="props-title">Properties</h2>
          <ProvenanceBadge value={m.provenance} />
        </div>
        <table className={styles.props}>
          <caption className="sr-only">Material properties</caption>
          <tbody>
            {rows.map(([k, v]) => <tr key={k}><th scope="row"><WithTerms text={k} /></th><td>{v}</td></tr>)}
          </tbody>
        </table>
        {m.source && <p className={styles.source}>Source: {m.source}</p>}
      </section>

      <div>
        <section className={styles.panel} aria-labelledby="scores-title">
          <h2 className={styles.panelTitle} id="scores-title">Scores</h2>
          <p className={styles.panelSub}>0–100, higher is better.</p>
          <div className={styles.gap}><IndicatorBars values={m.indicators} large /></div>
        </section>

        <section className={`${styles.panel} ${styles.gap}`} aria-labelledby="use-title">
          <h2 className={styles.panelTitle} id="use-title">Where it's used</h2>
          {m.applications?.length > 0 && <ul className={styles.tags}>{m.applications.map((a) => <li key={a}>{a}</li>)}</ul>}
          {m.notes && <p className={styles.hint}>{m.notes}</p>}
          {m.standards?.length > 0 && (
            <>
              <h3 className={styles.subhead}>Food-contact standards</h3>
              <ul className={styles.tags}>{m.standards.map((s) => <li key={s}>{s}</li>)}</ul>
            </>
          )}
          {m.usedInStructures?.length > 0 && (
            <>
              <h3 className={styles.subhead}>In library structures</h3>
              <ul className={styles.links}>
                {m.usedInStructures.map((s) => (
                  <li key={s.structureId}><Link to={`/builder?structure=${encodeURIComponent(s.structureId)}`}>{s.name}</Link></li>
                ))}
              </ul>
            </>
          )}
        </section>

        {m.similar?.length > 0 && (
          <section className={`${styles.panel} ${styles.gap}`} aria-labelledby="similar-title">
            <h2 className={styles.panelTitle} id="similar-title">Similar materials</h2>
            <p className={styles.panelSub}>Closest by score profile.</p>
            <ul className={styles.links}>
              {m.similar.map((s) => <li key={s.materialId}><Link to={`/materials/${s.materialId}`}>{s.name}</Link></li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default function MaterialDetailPage() {
  const { materialId } = useParams();
  const headingRef = useFocusOnMount();
  const { status, data, error, retry } = useQuery((signal) => getMaterial(materialId, { signal }), materialId);
  const m = data?.materialId?.toUpperCase() === materialId.toUpperCase() ? data : null;

  return (
    <>
      <Link className={styles.back} to="/materials"><span aria-hidden="true">←</span> All materials</Link>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Material</p>
        <h1 className={styles.title} tabIndex={-1} ref={headingRef}>{m ? m.name : status === 'error' ? 'Material not found' : 'Loading…'}</h1>
        {m && <p className={styles.sub}>{label(m.family)} · {m.polymerClass} · ID {m.materialId}</p>}
      </header>
      {status === 'error' && (
        <div className={styles.gap}>
          <Notice tone="danger" title="Couldn't load this material" role="alert"
            actions={<>
              {error?.code !== 'NOT_FOUND' && <Button size="sm" variant="ghost" onClick={retry}>Try again</Button>}
              <Button size="sm" variant="ghost" to="/materials">Back to all materials</Button>
            </>}>
            {error?.message}
          </Notice>
        </div>
      )}
      {!m && status === 'loading' && (
        <div className={`${styles.detailGrid} ${styles.gapLg}`} aria-hidden="true">
          <div className={styles.panel}><Skeleton height={300} /></div>
          <div className={styles.panel}><Skeleton height={160} /></div>
        </div>
      )}
      {m && <Detail m={m} />}
    </>
  );
}
