import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useWizard } from '../../context/WizardContext';
import { useAnnounce } from '../../context/AnnouncerContext';
import { FOOD_CATEGORIES, PROFILE_FIELDS, RESPIRATION_CLASSES, SENSITIVITY_LEVELS, foodCategory, optionLabel } from '../../data/wizard';
import { hasCommodity, validateProfile } from '../../lib/wizardModel';
import { searchCommodities } from '../../services/api';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import { cx } from '../../utils/cx';
import Button from '../../components/Button';
import CommoditySearch from '../../components/wizard/CommoditySearch';
import ChoiceGroup from '../../components/wizard/ChoiceGroup';
import Field from '../../components/wizard/Field';
import Notice from '../../components/wizard/Notice';
import Skeleton from '../../components/wizard/Skeleton';
import StepActions from '../../components/wizard/StepActions';
import ProfileEditor from './ProfileEditor';
import tile from '../../styles/iconTile.module.css';
import fieldStyles from '../../components/wizard/Field.module.css';
import styles from './Wizard.module.css';
import own from './FoodStep.module.css';

const SUMMARY_OPTIONS = { respirationClass: RESPIRATION_CLASSES, oxidationSensitivity: SENSITIVITY_LEVELS };

/** "Moisture 94 % · Fat 0.2 % · pH 4.5 · …" from the profile values that are filled in. */
function profileSummary(fields) {
  return ['moisturePct', 'fatPct', 'ph', 'respirationClass', 'oxidationSensitivity']
    .filter((k) => fields[k] !== '')
    .map((k) => {
      const f = PROFILE_FIELDS[k];
      const v = SUMMARY_OPTIONS[k] ? optionLabel(SUMMARY_OPTIONS[k], fields[k]).toLowerCase() : fields[k];
      return `${f.label} ${v}${f.unit ? ` ${f.unit}` : ''}`;
    })
    .join(' · ');
}

/** The chosen food, with its properties behind "Edit values". */
function SelectedFood({ open, setOpen, attempted, onNext }) {
  const { state, loadCommodity } = useWizard();
  const load = state.commodityLoad;

  if (load.status === 'loading') {
    return (
      <section className={cx(styles.panel, own.selectedPanel)} aria-busy="true" aria-labelledby="selected-title">
        <h2 className={styles.panelTitle} id="selected-title">Loading {load.name || 'food'}…</h2>
        <p className="sr-only" role="status">Loading the default food profile.</p>
        <div className={own.selectedSkel} aria-hidden="true"><Skeleton width="50%" /><Skeleton width="80%" height={12} /></div>
      </section>
    );
  }
  if (load.status === 'error') {
    return (
      <Notice
        tone="danger"
        role="alert"
        title={`Couldn't load the profile for ${load.name}`}
        actions={<Button size="sm" onClick={() => loadCommodity({ commodityId: load.commodityId, name: load.name })}>Try again</Button>}
      >
        {load.error?.message} You can also pick another food below.
      </Notice>
    );
  }
  if (!hasCommodity(state)) return null;

  const { commodity, profile } = state;
  const cat = profile.fields.category ? foodCategory(profile.fields.category) : null;
  const summary = profileSummary(profile.fields);
  return (
    <section className={cx(styles.panel, own.selectedPanel)} aria-labelledby="selected-title" data-cat={cat?.cat}>
      <div className={own.selectedHead}>
        {cat && <span className={cx(tile.tile, own.cardIcon)} aria-hidden="true"><cat.Icon /></span>}
        <div className={own.selectedText}>
          <p className={own.selectedEyebrow}>Selected food</p>
          <h2 className={styles.panelTitle} id="selected-title">{commodity.commodityName || 'Custom food'}</h2>
          <p className={styles.panelSub}>
            {cat ? cat.label : 'Category not set'}
            {commodity.isCustom ? ' · custom entry, lower confidence' : ''}
          </p>
        </div>
        <div className={own.selectedActions}>
          <Button variant="ghost" size="sm" aria-expanded={open} aria-controls="profile-editor" onClick={() => setOpen(!open)}>
            {open ? 'Hide values' : 'Edit values'}
          </Button>
          <Button size="sm" onClick={onNext}>Next: journey <span aria-hidden="true">→</span></Button>
        </div>
      </div>
      {summary
        ? <p className={own.summary}>{summary}</p>
        : <p className={own.summary}>No properties entered yet.</p>}
      {profile.source && <p className={styles.meta}><strong>Source:</strong> {profile.source}</p>}
      <div id="profile-editor" hidden={!open} className={own.editor}>
        {open && <ProfileEditor attempted={attempted} />}
      </div>
    </section>
  );
}

/** Step 1: pick the food, and optionally adjust its properties. */
export default function FoodStep() {
  const { state, loadCommodity, startCustom } = useWizard();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const [params, setParams] = useSearchParams();
  const headingRef = useFocusOnMount();

  const filter = params.get('category') || '';
  const [popular, setPopular] = useState({ status: 'loading', items: [] });
  const [reloadKey, setReloadKey] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customError, setCustomError] = useState('');
  const [attempted, setAttempted] = useState(false);
  // Custom foods start with empty values, and a rejected value needs fixing, so the editor opens for those.
  const profileRejected = Object.keys(state.fieldErrors).some((k) => k.startsWith('commodity.'));
  const [editorOpen, setEditorOpen] = useState(state.commodity.isCustom || profileRejected);

  useEffect(() => {
    const ctrl = new AbortController();
    setPopular((p) => ({ ...p, status: 'loading' }));
    searchCommodities('', { signal: ctrl.signal })
      .then((data) => setPopular({ status: 'done', items: data.results || [] }))
      .catch(() => { if (!ctrl.signal.aborted) setPopular({ status: 'error', items: [] }); });
    return () => ctrl.abort();
  }, [reloadKey]);

  const selectedId = state.commodity.isCustom ? null : state.commodity.commodityId;
  const visible = filter ? popular.items.filter((c) => c.category === filter) : popular.items;

  function showSelected() {
    requestAnimationFrame(() => document.getElementById('selected-title')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  function select(item) {
    // Re-selecting the current commodity keeps any edits already made to its profile.
    if (item.commodityId !== selectedId) {
      loadCommodity(item);
      setEditorOpen(false);
      setAttempted(false);
    }
    announce(`${item.name} selected.`);
    showSelected();
  }

  function openCustom(name = '') {
    setCustomOpen(true);
    setCustomName(name);
    setCustomCategory(filter);
    setCustomError('');
    requestAnimationFrame(() => document.getElementById('custom-name')?.focus());
  }

  function submitCustom(e) {
    e.preventDefault();
    if (!customName.trim()) {
      setCustomError('Give your commodity a name');
      document.getElementById('custom-name')?.focus();
      return;
    }
    startCustom({ name: customName.trim(), category: customCategory });
    setCustomOpen(false);
    setEditorOpen(true);
    setAttempted(false);
    announce(`${customName.trim()} added as a custom food. Enter what you know about it.`);
    showSelected();
  }

  function setFilter(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('category', value); else next.delete('category');
    setParams(next, { replace: true });
  }

  function handleNext() {
    setAttempted(true);
    const errors = validateProfile(state);
    const keys = Object.keys(errors);
    if (keys.length) {
      setEditorOpen(true);
      announce('Please fix the highlighted values.');
      requestAnimationFrame(() => document.getElementById(keys[0] === 'commodityName' ? 'commodity-name' : 'profile-' + keys[0])?.focus());
      return;
    }
    navigate('/analyze/journey');
  }

  const ready = hasCommodity(state) && state.commodityLoad.status === 'idle';

  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Step 1 of 3</p>
      <h1 className={styles.title} tabIndex={-1} ref={headingRef}>What are you packaging?</h1>
      <p className={styles.sub}>
        Search the catalog or pick a popular food. Its typical properties load with their sources, and you can edit any of them.
      </p>

      <div className={own.searchRow}>
        <CommoditySearch onSelect={select} onCustom={openCustom} />
      </div>

      <div className={own.selectedRow}>
        <SelectedFood open={editorOpen} setOpen={setEditorOpen} attempted={attempted} onNext={handleNext} />
      </div>

      <section className={styles.section} aria-labelledby="popular-title">
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle} id="popular-title">{ready ? 'Choose a different food' : 'Popular foods'}</h2>
            <p className={styles.sectionSub}>One click loads a food's default profile.</p>
          </div>
        </div>
        <div className={own.filters} role="group" aria-label="Filter by category">
          <button type="button" className={own.filter} aria-pressed={!filter} onClick={() => setFilter('')}>All</button>
          {FOOD_CATEGORIES.map((c) => (
            <button key={c.value} type="button" className={own.filter} aria-pressed={filter === c.value} onClick={() => setFilter(c.value)}>
              {c.label}
            </button>
          ))}
        </div>

        {popular.status === 'loading' && (
          <ul className={own.grid} aria-label="Loading foods">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={own.skelCard} aria-hidden="true">
                <Skeleton width={40} height={40} radius={10} />
                <div className={own.skelText}><Skeleton width="60%" /><Skeleton width="40%" height={12} /></div>
              </li>
            ))}
          </ul>
        )}
        {popular.status === 'error' && (
          <Notice
            tone="danger"
            title="Couldn't load popular foods"
            role="alert"
            actions={<Button size="sm" variant="ghost" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}
          >
            You can still search above or enter a custom commodity.
          </Notice>
        )}
        {popular.status === 'done' && visible.length === 0 && (
          <p className={own.empty}>No catalog foods in this category yet. Try another category or enter a custom commodity.</p>
        )}
        {popular.status === 'done' && visible.length > 0 && (
          <ul className={own.grid}>
            {visible.map((item) => {
              const cat = foodCategory(item.category);
              const selected = item.commodityId === selectedId;
              return (
                <li key={item.commodityId} data-cat={cat.cat}>
                  <button type="button" className={own.card} aria-pressed={selected} onClick={() => select(item)}>
                    <span className={cx(tile.tile, own.cardIcon)} aria-hidden="true"><cat.Icon /></span>
                    <span className={own.cardText}>
                      <span className={own.cardName}>{item.name}</span>
                      <span className={own.cardCat}>{cat.label}</span>
                    </span>
                    {selected && <span className={own.selected} aria-hidden="true">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={cx(styles.section, styles.panel)} aria-labelledby="custom-title">
        <div className={own.customHead}>
          <div>
            <h2 className={styles.panelTitle} id="custom-title">Not in the catalog?</h2>
            <p className={styles.panelSub}>
              Enter a custom commodity and fill in its properties yourself. Results are flagged as lower confidence.
            </p>
          </div>
          {!customOpen && <Button variant="ghost" onClick={() => openCustom()}>Enter a custom commodity</Button>}
        </div>
        {customOpen && (
          <form className={own.customForm} noValidate onSubmit={submitCustom}>
            <Field id="custom-name" label="Commodity name" error={customError}>
              <input
                id="custom-name"
                className={fieldStyles.input}
                type="text"
                maxLength={80}
                placeholder="e.g. Cold-pressed mango juice"
                value={customName}
                aria-invalid={customError ? 'true' : undefined}
                aria-describedby={customError ? 'custom-name-error' : undefined}
                onChange={(e) => { setCustomName(e.target.value); setCustomError(''); }}
              />
            </Field>
            <ChoiceGroup
              name="custom-category"
              legend="Category (optional)"
              options={FOOD_CATEGORIES}
              value={customCategory}
              onChange={setCustomCategory}
            />
            <div className={own.customActions}>
              <Button type="submit">Use this custom food</Button>
              <Button variant="ghost" onClick={() => setCustomOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </section>

      <StepActions
        backTo="/"
        backLabel="Home"
        nextLabel={ready ? `Next: journey for ${state.commodity.commodityName || 'custom food'}` : null}
        onNext={handleNext}
      />
    </div>
  );
}
