import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useWizard } from '../../context/WizardContext';
import { evaluate, listMaterials, listStructures, searchCommodities } from '../../services/api';
import { useQuery } from '../../hooks/useQuery';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import { initialScenario, scenarioRule, storageProblem, toRequest, wizardScenario } from '../../lib/scenario';
import { useStorageRules } from '../../hooks/useStorageRules';
import { inr, label, num } from '../../utils/format';
import Button from '../../components/Button';
import Term from '../../components/Term';
import Notice from '../../components/wizard/Notice';
import ProvenanceBadge from '../../components/wizard/ProvenanceBadge';
import RequirementTable from '../../components/wizard/RequirementTable';
import Skeleton from '../../components/wizard/Skeleton';
import ShelfLifeVerdict from '../../components/wizard/ShelfLifeVerdict';
import SpecificationPanel from '../../components/wizard/SpecificationPanel';
import ScenarioEditor from '../../components/tools/ScenarioEditor';
import styles from './Tools.module.css';

const MAX_LAYERS = 7;
const PERFORATIONS = [['none', 'None'], ['micro', 'Micro-perforated'], ['macro', 'Macro-perforated']];

function stackFrom(structure) {
  return {
    baseId: structure.structureId,
    edited: false,
    perforation: structure.perforation || 'none',
    layers: structure.layers.map((l) => ({ materialId: l.materialId, thicknessUm: String(l.thicknessUm) })),
  };
}

function structurePayload(stack) {
  if (stack.baseId && !stack.edited) return { structureId: stack.baseId };
  const layers = stack.layers.map((l) => ({ materialId: l.materialId, thicknessUm: Number(l.thicknessUm) }));
  if (!layers.length || layers.some((l) => !(l.thicknessUm > 0 && l.thicknessUm <= 300))) return null;
  return { layers, perforation: stack.perforation };
}

function LayerEditor({ stack, setStack, materials }) {
  const update = (layers, extra = {}) => setStack({ ...stack, ...extra, layers, edited: true });
  const setLayer = (i, patch) => update(stack.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i, d) => {
    const next = [...stack.layers];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    update(next);
  };
  const remove = (i) => update(stack.layers.filter((_, j) => j !== i));
  const add = () => update([...stack.layers.slice(0, -1), { materialId: 'BOPP', thicknessUm: '20' }, ...stack.layers.slice(-1)]);

  return (
    <>
      <ol className={styles.layers} aria-label="Layers, outside to inside">
        {stack.layers.map((l, i) => {
          const name = materials.find((m) => m.materialId === l.materialId)?.name || l.materialId;
          const n = i + 1;
          const thickOk = Number(l.thicknessUm) > 0 && Number(l.thicknessUm) <= 300;
          return (
            <li key={i} className={styles.layerRow}>
              <span className={styles.layerIndex} aria-hidden="true">{n}</span>
              <select className={styles.select} aria-label={`Layer ${n} material`} value={l.materialId} onChange={(e) => setLayer(i, { materialId: e.target.value })}>
                {materials.map((m) => <option key={m.materialId} value={m.materialId}>{m.name}</option>)}
              </select>
              <span className={styles.control}>
                <input className={styles.input} type="number" min="1" max="300" step="1" inputMode="decimal"
                  aria-label={`Layer ${n} thickness in micrometres`} aria-invalid={thickOk ? undefined : 'true'}
                  value={l.thicknessUm} onChange={(e) => setLayer(i, { thicknessUm: e.target.value })} />
              </span>
              <span className={styles.layerTools}>
                <button type="button" className={styles.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${name} out`}>↑</button>
                <button type="button" className={styles.iconBtn} onClick={() => move(i, 1)} disabled={i === stack.layers.length - 1} aria-label={`Move ${name} in`}>↓</button>
                <button type="button" className={styles.iconBtn} onClick={() => remove(i)} disabled={stack.layers.length === 1} aria-label={`Remove ${name}`}>×</button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className={styles.layerEnds} aria-hidden="true"><span>↑ Outside (print)</span><span>Food side (seal) ↓</span></p>
      <div className={styles.row}>
        <Button size="sm" variant="ghost" onClick={add} disabled={stack.layers.length >= MAX_LAYERS}>Add layer</Button>
        <label className={styles.control}>
          <span className="sr-only">Perforation</span>
          <select className={styles.select} value={stack.perforation} onChange={(e) => setStack({ ...stack, perforation: e.target.value, edited: true })}>
            {PERFORATIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>
      <p className={styles.hint}>Thickness in µm. The innermost layer is the heat seal.</p>
    </>
  );
}

function Indicators({ data }) {
  const ind = data.indicators;
  const high = ['oxygen', 'moisture'].filter((k) => ind.barrier[k] === 'high');
  return (
    <section className={styles.panel} aria-labelledby="ind-title">
      <div className={styles.panelHead}>
        <div>
          <h2 className={styles.panelTitle} id="ind-title">{data.structure.name}</h2>
          <p className={styles.panelSub}>{num(data.structure.totalGaugeUm, 'µm')} total · per pack</p>
        </div>
        <ProvenanceBadge value={ind.provenance} />
      </div>
      <ShelfLifeVerdict shelfLife={ind.shelfLife} highBarrier={high.length ? high.join(' and ') : null} />
      <dl className={`${styles.tiles} ${styles.gap}`}>
        <div className={styles.tile}><dt>Cost</dt><dd>{inr(ind.costInrPerPack)}<small>{label(ind.costBand)} band</small></dd></div>
        <div className={styles.tile}><dt>Oxygen barrier</dt><dd>{label(ind.barrier.oxygen)}<small><Term term="OTR" /> {num(ind.barrier.otrTest)}</small></dd></div>
        <div className={styles.tile}><dt>Moisture barrier</dt><dd>{label(ind.barrier.moisture)}<small><Term term="WVTR" /> {num(ind.barrier.wvtrTest)}</small></dd></div>
        <div className={styles.tile}><dt>Carbon</dt><dd>{num(ind.sustainability.gCo2ePerPack, 'g')}<small>CO₂e per pack</small></dd></div>
        <div className={styles.tile}>
          <dt>Recyclability</dt>
          <dd>{ind.sustainability.recyclabilityIndex}/100<small>{ind.sustainability.recyclable ? 'Recyclable' : 'Hard to recycle'} · <Term term="EPR" /> {ind.sustainability.eprCategory}</small></dd>
        </div>
        <div className={styles.tile}><dt>Strength</dt><dd>{ind.mechanicalIndex}/100<small><Term term="mechanical index">Mechanical index</Term></small></dd></div>
      </dl>
      <div className={styles.gap}>
        {data.violations?.length ? (
          <Notice tone="warn" title="The analysis would rule this out">
            <ul className={styles.violations}>{data.violations.map((v, i) => <li key={i}>{v}</li>)}</ul>
          </Notice>
        ) : (
          <Notice tone="info" title="Passes every hard check">Sealing, food contact, transport stress and your hard constraints.</Notice>
        )}
      </div>
    </section>
  );
}

/** Package Builder (Features Report §2): edit a layer stack and see it evaluated live. */
export default function BuilderPage() {
  const headingRef = useFocusOnMount();
  const { state: wizard } = useWizard();
  const [params] = useSearchParams();
  const fromAnalysis = useMemo(() => wizardScenario(wizard), [wizard]);
  const [scenario, setScenario] = useState(() => initialScenario(wizard));
  const [stack, setStack] = useState(null);

  const catalog = useQuery((signal) => searchCommodities('', { signal }), 'catalog');
  const materials = useQuery((signal) => listMaterials({}, { signal }), 'materials');
  const structures = useQuery((signal) => listStructures({ signal }), 'structures');
  const library = structures.data?.results;

  // Start from ?structure=, else the wizard's recommendation, else the first library structure.
  const wanted = params.get('structure') || wizard.analysis.result?.recommendation?.structureId;
  useEffect(() => {
    if (!library?.length) return;
    const pick = library.find((s) => s.structureId === wanted?.toUpperCase()) || library[0];
    setStack(stackFrom(pick));
  }, [library, wanted]);

  const rule = scenarioRule(useStorageRules(), scenario);
  const unsupported = storageProblem(rule, scenario.conditions);
  const request = toRequest(scenario, scenario.conditions, rule);
  const structure = stack && structurePayload(stack);
  const payload = request && structure ? { scenario: request, structure } : null;
  const result = useQuery((signal) => evaluate(payload, { signal }), payload ? JSON.stringify(payload) : null, { delay: 350 });

  const loadError = materials.error || structures.error;
  const ready = stack && materials.data;

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Package Builder</p>
        <h1 className={styles.title} tabIndex={-1} ref={headingRef}>Build your own package</h1>
        <p className={styles.sub}>
          Start from a library structure, then swap materials, change thicknesses or add layers. Each change is
          checked by the same engine as the analysis.
        </p>
      </header>

      {loadError && (
        <div className={styles.gap}>
          <Notice tone="danger" title="Couldn't load the material library" role="alert"
            actions={<Button size="sm" variant="ghost" onClick={() => { materials.retry(); structures.retry(); }}>Try again</Button>}>
            {loadError.message}
          </Notice>
        </div>
      )}

      <div className={styles.workspace}>
        <div className={styles.sticky}>
          <section className={styles.panel} aria-labelledby="stack-title">
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle} id="stack-title">Layers</h2>
                <p className={styles.panelSub}>{stack?.edited ? 'Custom structure' : 'Library structure'}</p>
              </div>
            </div>
            {library && (
              <label className={styles.control}>
                Start from
                <select className={styles.select} value={stack && !stack.edited ? stack.baseId : ''}
                  onChange={(e) => { const s = library.find((x) => x.structureId === e.target.value); if (s) setStack(stackFrom(s)); }}>
                  {stack?.edited && <option value="">Custom (edited)</option>}
                  {library.map((s) => <option key={s.structureId} value={s.structureId}>{s.name}</option>)}
                </select>
              </label>
            )}
            {ready ? <LayerEditor stack={stack} setStack={setStack} materials={materials.data.results} /> : !loadError && <Skeleton height={180} />}
          </section>

          <section className={`${styles.panel} ${styles.gap}`} aria-labelledby="scn-title">
            <h2 className={styles.panelTitle} id="scn-title">Food and conditions</h2>
            <p className={styles.panelSub}>{scenario.commodityKey === '__analysis__' ? 'From your analysis. Changes here stay in the Builder.' : 'Pick a food and set where it will be stored.'}</p>
            <div className={styles.gap}>
              <ScenarioEditor idPrefix="bld" scenario={scenario} onChange={setScenario} catalog={catalog.data?.results} fromAnalysis={fromAnalysis} rule={rule} />
            </div>
          </section>
        </div>

        <div>
          <p className={styles.status} role="status" aria-live="polite">
            {result.status === 'loading' && payload ? 'Evaluating…' : !payload && ready && !unsupported ? 'Fix the highlighted values to evaluate.' : ''}
          </p>
          {unsupported && (
            <Notice tone="warn" title="These conditions aren't supported for this food">
              {unsupported} Change the storage under Food and conditions to evaluate a package.
            </Notice>
          )}
          {result.status === 'error' && (
            <Notice tone={result.error?.code === 'NOT_AVAILABLE' ? 'info' : 'danger'} title={result.error?.code === 'NOT_AVAILABLE' ? 'Needs the backend' : "Couldn't evaluate this package"}
              actions={result.error?.code !== 'NOT_AVAILABLE' && <Button size="sm" variant="ghost" onClick={result.retry}>Try again</Button>}>
              {result.error?.message}
            </Notice>
          )}
          {!result.data && result.status === 'loading' && <div className={styles.panel}><Skeleton height={260} /></div>}
          {result.data && payload && (
            <div className={result.status === 'loading' ? styles.busy : undefined}>
              <Indicators data={result.data} />
              <section className={`${styles.panel} ${styles.gap}`} aria-labelledby="breq-title">
                <h2 className={styles.panelTitle} id="breq-title">Requirements</h2>
                <p className={styles.panelSub}>What this food needs under these conditions, and how this structure performs.</p>
                <RequirementTable rows={result.data.requirements} />
              </section>
              <div className={styles.gap}>
                <SpecificationPanel spec={result.data.specifications} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
