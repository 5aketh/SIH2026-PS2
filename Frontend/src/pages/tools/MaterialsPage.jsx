import { Link, useSearchParams } from 'react-router';
import { listMaterials, listStructures } from '../../services/api';
import { useQuery } from '../../hooks/useQuery';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import { label, num } from '../../utils/format';
import Button from '../../components/Button';
import Term from '../../components/Term';
import IndicatorBars, { NO_SEAL_NOTE } from '../../components/IndicatorBars';
import Skeleton from '../../components/wizard/Skeleton';
import Notice from '../../components/wizard/Notice';
import LayerStack from '../../components/wizard/LayerStack';
import styles from './Tools.module.css';

const FAMILY_LABELS = { evoh: 'EVOH' };
const familyLabel = (f) => FAMILY_LABELS[f] || label(f);

const SORTS = [
  ['name', 'Name'],
  ['oxygenBarrier', 'Best oxygen barrier'],
  ['moistureBarrier', 'Best moisture barrier'],
  ['mechanicalStrength', 'Strongest'],
  ['sustainability', 'Most sustainable'],
  ['cost', 'Lowest cost'],
];

function LoadError({ error, retry }) {
  return (
    <Notice tone="danger" title="Couldn't load the knowledge base" role="alert"
      actions={<Button size="sm" variant="ghost" onClick={retry}>Try again</Button>}>
      {error?.message}
    </Notice>
  );
}

function CardSkeletons() {
  return (
    <ul className={styles.grid} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className={styles.card}>
          <Skeleton height={20} width="70%" />
          <Skeleton height={12} width="40%" />
          <Skeleton height={80} />
        </li>
      ))}
    </ul>
  );
}

function Films({ params, setParam }) {
  const q = params.get('q') || '';
  const family = params.get('family') || '';
  const sort = params.get('sort') || 'name';
  const compostable = params.get('compostable') === '1';
  const filters = { q, family, sort, compostable };
  const { status, data, error, retry } = useQuery((signal) => listMaterials(filters, { signal }), JSON.stringify(filters), { delay: q ? 250 : 0 });
  const results = data?.results || [];

  return (
    <>
      <div className={styles.controls}>
        <label className={`${styles.control} ${styles.search}`}>
          Search
          <input className={styles.input} type="search" value={q} placeholder="Name, family or use, e.g. retort"
            onChange={(e) => setParam('q', e.target.value)} />
        </label>
        <label className={styles.control}>
          Sort by
          <select className={styles.select} value={sort} onChange={(e) => setParam('sort', e.target.value === 'name' ? '' : e.target.value)}>
            {SORTS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={compostable} onChange={(e) => setParam('compostable', e.target.checked ? '1' : '')} />
          Compostable only
        </label>
      </div>
      {data?.families && (
        <div className={styles.chips} role="group" aria-label="Material family">
          <button type="button" className={styles.chip} aria-pressed={!family} onClick={() => setParam('family', '')}>All</button>
          {data.families.map((f) => (
            <button key={f} type="button" className={styles.chip} aria-pressed={family === f} onClick={() => setParam('family', family === f ? '' : f)}>
              {familyLabel(f)}
            </button>
          ))}
        </div>
      )}

      {status === 'error' && <div className={styles.gap}><LoadError error={error} retry={retry} /></div>}
      {status === 'loading' && !data && <CardSkeletons />}
      {data && (
        <>
          <p className={styles.count} role="status">{results.length} {results.length === 1 ? 'material' : 'materials'}</p>
          {results.length === 0 ? (
            <p className={styles.sub}>No materials match. Clear a filter to see more.</p>
          ) : (
            <ul className={`${styles.grid} ${status === 'loading' ? styles.busy : ''}`}>
              {results.map((m) => (
                <li key={m.materialId}>
                  <article className={styles.card}>
                    <div>
                      <h2 className={styles.cardTitle}>
                        <Link className={styles.cardLink} to={`/materials/${m.materialId}`}>{m.name}</Link>
                      </h2>
                      <p className={styles.cardMeta}>{familyLabel(m.family)} · {m.polymerClass}{m.properties.compostable ? ' · compostable' : ''}</p>
                    </div>
                    <IndicatorBars values={m.indicators} />
                    {m.properties.sealability === 'none' && <p className={styles.cardNote}>{NO_SEAL_NOTE}</p>}
                    <dl className={styles.facts}>
                      <div><dt><Term term="OTR" /></dt><dd>{num(m.properties.otr.value)}</dd></div>
                      <div><dt><Term term="WVTR" /></dt><dd>{num(m.properties.wvtr.value)}</dd></div>
                      <div><dt>₹/kg</dt><dd>{m.properties.costInrPerKg.join('–')}</dd></div>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function Structures() {
  const { status, data, error, retry } = useQuery((signal) => listStructures({ signal }), 'structures');
  if (status === 'error') return <div className={styles.gap}><LoadError error={error} retry={retry} /></div>;
  if (!data) return <CardSkeletons />;
  return (
    <>
      <p className={styles.count}>{data.results.length} library structures, outside layer first</p>
      <ul className={styles.grid}>
        {data.results.map((s) => (
          <li key={s.structureId}>
            <article className={styles.card}>
              <div>
                <h2 className={styles.cardTitle}>{s.name}</h2>
                <p className={styles.cardMeta}>
                  {s.gasMode === 'breathable' ? 'Breathable' : 'Barrier'}
                  {s.perforation !== 'none' && ` · ${s.perforation}-perforated`} · {num(s.totalGaugeUm, 'µm')}
                </p>
              </div>
              <LayerStack layers={s.layers} />
              <dl className={styles.facts}>
                <div><dt><Term term="OTR" /></dt><dd>{num(s.otrTest)}</dd></div>
                <div><dt><Term term="WVTR" /></dt><dd>{num(s.wvtrTest)}</dd></div>
                <div><dt>Strength</dt><dd>{s.mechanicalIndex}/100</dd></div>
                <div><dt>Recyclability</dt><dd>{s.recyclabilityIndex}/100</dd></div>
              </dl>
              {s.applications?.length > 0 && <p className={styles.cardMeta}>{s.applications.join(' · ')}</p>}
              <div className={styles.cardActions}>
                <Button size="sm" variant="ghost" to={`/builder?structure=${encodeURIComponent(s.structureId)}`}>
                  Open in Builder<span className="sr-only">: {s.name}</span>
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Material Explorer (Features Report §4): films and library structures from the knowledge base. */
export default function MaterialsPage() {
  const headingRef = useFocusOnMount();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'structures' ? 'structures' : 'films';

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Material Explorer</p>
        <h1 className={styles.title} tabIndex={-1} ref={headingRef}>Packaging materials</h1>
        <p className={styles.sub}>
          Every film and structure the engine can recommend, with the data it uses. Scores run from 0 to 100, higher is better;{' '}
          <Term term="OTR" /> is in cc/m²·day·atm and <Term term="WVTR" /> in g/m²·day at the film's reference thickness.
        </p>
      </header>
      <div className={styles.tabs} role="tablist" aria-label="What to browse">
        <button type="button" role="tab" className={styles.tab} aria-selected={view === 'films'} onClick={() => setParam('view', '')}>Films</button>
        <button type="button" role="tab" className={styles.tab} aria-selected={view === 'structures'} onClick={() => setParam('view', 'structures')}>Structures</button>
      </div>
      <div role="tabpanel" aria-label={view === 'films' ? 'Films' : 'Structures'}>
        {view === 'films' ? <Films params={params} setParam={setParam} /> : <Structures />}
      </div>
    </>
  );
}
