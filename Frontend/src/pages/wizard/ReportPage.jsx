import { useState } from 'react';
import { Navigate } from 'react-router';
import { useWizard } from '../../context/WizardContext';
import {
  CONDITION_FIELDS, FOOD_CATEGORIES, PRIORITY_FIELDS, PROFILE_FIELDS, RESPIRATION_CLASSES,
  SENSITIVITY_LEVELS, STORAGE_TYPES, TRANSPORT_MODES, TRANSPORT_STRESS, constraintLabel, optionLabel,
} from '../../data/wizard';
import { PROFILE_KEYS, buildAnalyzePayload, lowConfidence } from '../../lib/wizardModel';
import { USING_MOCKS, fetchReportPdf } from '../../services/api';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import Button from '../../components/Button';
import AssumptionsPanel from '../../components/wizard/AssumptionsPanel';
import ComparisonTable from '../../components/wizard/ComparisonTable';
import ConfidenceBadge from '../../components/wizard/ConfidenceBadge';
import FreshProducePanel from '../../components/wizard/FreshProducePanel';
import KeyFigures from '../../components/wizard/KeyFigures';
import Notice from '../../components/wizard/Notice';
import ProvenanceBadge from '../../components/wizard/ProvenanceBadge';
import RisksPanel from '../../components/wizard/RisksPanel';
import SpecificationPanel from '../../components/wizard/SpecificationPanel';
import WhyThisPanel from '../../components/wizard/WhyThisPanel';
import resultStyles from '../../components/wizard/Result.module.css';
import styles from './Wizard.module.css';
import own from './ReportPage.module.css';

const PROFILE_OPTIONS = { category: FOOD_CATEGORIES, respirationClass: RESPIRATION_CLASSES, oxidationSensitivity: SENSITIVITY_LEVELS };
const CONDITION_OPTIONS = { storageType: STORAGE_TYPES, transportMode: TRANSPORT_MODES, transportStress: TRANSPORT_STRESS };

function display(value, options, unit) {
  if (value === '' || value === null || value === undefined) return <span className={resultStyles.na}>Not provided</span>;
  if (options) return optionLabel(options, value);
  return unit ? `${value} ${unit}` : value;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Screen 7: side-by-side comparison and export. */
export default function ReportPage() {
  const { state, dispatch } = useWizard();
  const headingRef = useFocusOnMount();
  const [exportStatus, setExportStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const result = state.analysis.result;

  if (!result) return <Navigate to="/analyze/journey" replace />;

  const alternatives = result.alternatives || [];
  const selected = state.compare ?? alternatives.map((_, i) => i);
  const stale = state.analysis.payloadKey !== JSON.stringify(buildAnalyzePayload(state));
  const confidence = lowConfidence(state);
  const { commodity, profile, conditions, priorities } = state;

  function toggleAlt(i) {
    const next = selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i].sort((a, b) => a - b);
    dispatch({ type: 'compare/set', indices: next });
  }

  async function handleExport() {
    if (!USING_MOCKS) {
      setExporting(true);
      setExportStatus('Preparing PDF…');
      try {
        const blob = await fetchReportPdf(result.analysisId);
        downloadBlob(blob, `packwise-report-${result.analysisId}.pdf`);
        setExportStatus('PDF downloaded.');
        setExporting(false);
        return;
      } catch {
        setExportStatus("The server's PDF export isn't available, so your browser's print dialog opened instead. Choose “Save as PDF”.");
      }
      setExporting(false);
    } else {
      setExportStatus("PDF export needs the backend, so your browser's print dialog opened instead. Choose “Save as PDF”.");
    }
    window.print();
  }

  const generated = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className={styles.page}>
      <header className={own.head}>
        <div>
          <p className={styles.eyebrow}>Packaging report</p>
          <h1 className={styles.title} tabIndex={-1} ref={headingRef}>{commodity.commodityName || 'Custom commodity'}</h1>
          <p className={styles.meta}>
            Analysis {result.analysisId} · Generated {generated}
            {USING_MOCKS && <> · <strong>Demo data (backend not connected)</strong></>}
          </p>
        </div>
        <div className={own.headActions} data-print="hide">
          <Button onClick={handleExport} disabled={exporting}>Export PDF</Button>
          <Button variant="ghost" to="/analyze/result">Back to result</Button>
        </div>
      </header>
      <p className={own.exportStatus} role="status" aria-live="polite" data-print="hide">{exportStatus}</p>

      {stale && (
        <div className={own.gap} data-print="hide">
          <Notice tone="warn" title="Your inputs changed since this analysis">
            This report reflects the inputs used for analysis {result.analysisId}. Re-run the analysis from the result screen to update it.
          </Notice>
        </div>
      )}

      <section className={`${resultStyles.panel} ${own.gap}`} aria-labelledby="rep-rec">
        <p className={resultStyles.eyebrow}>Recommended packaging structure</p>
        <div className={resultStyles.recTitleRow}>
          <h2 className={own.recName} id="rep-rec">{result.recommendation?.structure}</h2>
          <ConfidenceBadge value={result.recommendation?.confidence} />
        </div>
      </section>

      {result.warnings?.length > 0 && (
        <div className={own.gap}>
          <Notice tone="warn" title="Warnings">{result.warnings.join(' ')}</Notice>
        </div>
      )}

      {(result.shelfLife || result.costAndImpact) && (
        <div className={own.gap}>
          <KeyFigures shelfLife={result.shelfLife} costAndImpact={result.costAndImpact} />
        </div>
      )}

      <section className={`${resultStyles.panel} ${own.gap}`} aria-labelledby="rep-compare">
        <div className={own.compareHead}>
          <div>
            <h2 className={resultStyles.panelTitle} id="rep-compare">Side-by-side comparison</h2>
            <p className={resultStyles.panelSub}>The recommendation against the alternatives you pick, on the same requirement rows.</p>
          </div>
          {alternatives.length > 0 && (
            <fieldset className={own.picker} data-print="hide">
              <legend className="sr-only">Alternatives to include</legend>
              {alternatives.map((alt, i) => (
                <label key={alt.structure + i} className={own.pick}>
                  <input type="checkbox" checked={selected.includes(i)} onChange={() => toggleAlt(i)} />
                  {alt.structure}
                </label>
              ))}
            </fieldset>
          )}
        </div>
        {alternatives.length === 0 && <p className={resultStyles.empty}>No alternative candidates met the constraints.</p>}
        <ComparisonTable
          primary={{
            structure: result.recommendation?.structure, requirements: result.requirements,
            shelfLife: result.shelfLife, costAndImpact: result.costAndImpact,
          }}
          alternatives={selected.map((i) => alternatives[i]).filter(Boolean)}
        />
      </section>

      <div className={own.gap}>
        <WhyThisPanel reasons={result.why} />
      </div>
      {result.freshProduceMode && (
        <div className={own.gap}>
          <FreshProducePanel data={result.freshProduce} />
        </div>
      )}
      {result.specifications && (
        <div className={own.gap}>
          <SpecificationPanel spec={result.specifications} />
        </div>
      )}
      {result.risks?.length > 0 && (
        <div className={own.gap}>
          <RisksPanel risks={result.risks} />
        </div>
      )}

      <section className={`${resultStyles.panel} ${own.gap}`} aria-labelledby="rep-inputs">
        <h2 className={resultStyles.panelTitle} id="rep-inputs">Inputs</h2>
        <p className={resultStyles.panelSub}>What the analysis was given. Food property values keep their provenance labels.</p>
        {(confidence.isCustom || confidence.missing.length > 0) && (
          <p className={own.flag}>
            {confidence.isCustom ? 'Custom entry — lower confidence.' : 'Incomplete food profile — lower confidence.'}
            {confidence.missing.length > 0 && ` Missing: ${confidence.missing.join(', ')}.`}
          </p>
        )}

        <div className={own.inputsGrid}>
          <div>
            <h3 className={own.subhead}>Food profile</h3>
            <table className={resultStyles.table}>
              <caption className="sr-only">Food profile</caption>
              <tbody>
                {PROFILE_KEYS.map((key) => {
                  const f = PROFILE_FIELDS[key];
                  return (
                    <tr key={key}>
                      <th scope="row">{f.label}</th>
                      <td>{display(profile.fields[key], PROFILE_OPTIONS[key], f.unit)}</td>
                      <td className={own.badgeCell}><ProvenanceBadge value={profile.meta[key]?.provenance} confidence={profile.meta[key]?.confidence} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {profile.source && <p className={own.source}>Source: {profile.source}</p>}
          </div>

          <div>
            <h3 className={own.subhead}>Conditions</h3>
            <table className={resultStyles.table}>
              <caption className="sr-only">Storage and transport conditions</caption>
              <tbody>
                {Object.entries(CONDITION_FIELDS).map(([key, f]) => (
                  <tr key={key}>
                    <th scope="row">{f.label}</th>
                    <td>{display(conditions[key], CONDITION_OPTIONS[key], f.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={own.subhead}>Priorities</h3>
            <table className={resultStyles.table}>
              <caption className="sr-only">Priority weights</caption>
              <tbody>
                {PRIORITY_FIELDS.map((f) => (
                  <tr key={f.key}>
                    <th scope="row">{f.label}</th>
                    <td>{priorities[f.key].toFixed(1)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">Hard constraints</th>
                  <td>{priorities.hardConstraints.length ? priorities.hardConstraints.map((c) => constraintLabel(c)).join(', ') : <span className={resultStyles.na}>None</span>}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className={own.gap}>
        <AssumptionsPanel confidence={result.confidence} assumptions={result.assumptions} rejected={result.rejected} openRejected />
      </div>

      <p className={own.disclaimer}>
        Generated by PackWise decision support. Check each value's provenance label before using it as a specification.
      </p>
    </div>
  );
}
