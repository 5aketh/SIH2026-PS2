import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useWizard } from '../../context/WizardContext';
import { buildAnalyzePayload } from '../../lib/wizardModel';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import { conditionsSummary, verdictLine } from '../../utils/summary';
import Button from '../../components/Button';
import AlternativesList from '../../components/wizard/AlternativesList';
import AssumptionsPanel from '../../components/wizard/AssumptionsPanel';
import FreshProducePanel from '../../components/wizard/FreshProducePanel';
import Notice from '../../components/wizard/Notice';
import RecommendationHeader from '../../components/wizard/RecommendationHeader';
import RequirementTable from '../../components/wizard/RequirementTable';
import ResultSummary from '../../components/wizard/ResultSummary';
import RisksPanel from '../../components/wizard/RisksPanel';
import SpecificationPanel from '../../components/wizard/SpecificationPanel';
import WhyThisPanel from '../../components/wizard/WhyThisPanel';
import resultStyles from '../../components/wizard/Result.module.css';
import styles from './Wizard.module.css';
import own from './ResultPage.module.css';

/** Everything behind "Why this?": requirements, reasons, risks, specification, alternatives, what was ruled out. */
function Details({ result, onCompare }) {
  return (
    <div id="result-details">
      <section className={`${resultStyles.panel} ${own.gap}`} aria-labelledby="req-title">
        <h2 className={resultStyles.panelTitle} id="req-title">Requirements</h2>
        <p className={resultStyles.panelSub}>What the package has to achieve for this food and these conditions, and how the recommended structure performs against each.</p>
        <RequirementTable rows={result.requirements} />
      </section>

      <div className={result.freshProduceMode ? own.split : own.gap}>
        <WhyThisPanel reasons={result.why} />
        {result.freshProduceMode && <FreshProducePanel data={result.freshProduce} />}
      </div>

      {(result.risks?.length > 0 || result.specifications) && (
        <div className={result.risks?.length > 0 && result.specifications ? own.split : own.gap}>
          <RisksPanel risks={result.risks} />
          <SpecificationPanel spec={result.specifications} />
        </div>
      )}

      <div className={own.gap}>
        <AlternativesList items={result.alternatives} onCompare={onCompare} />
      </div>

      {/* Confidence reasons already show in the summary above. */}
      <div className={own.gap}>
        <AssumptionsPanel assumptions={result.assumptions} rejected={result.rejected} />
      </div>
    </div>
  );
}

/** Screen 6: a one-line verdict and the headline numbers first; the reasoning one click away. */
export default function ResultPage() {
  const { state, dispatch, runAnalysis, reset } = useWizard();
  const navigate = useNavigate();
  const headingRef = useFocusOnMount();
  const [showDetails, setShowDetails] = useState(false);
  const result = state.analysis.result;

  if (!result) return <Navigate to="/analyze/journey" replace />;

  const stale = state.analysis.payloadKey !== JSON.stringify(buildAnalyzePayload(state));
  const structureId = result.recommendation?.structureId;

  function compare(i) {
    dispatch({ type: 'compare/set', indices: [i] });
    navigate('/analyze/report');
  }

  function rerun() {
    runAnalysis();
    navigate('/analyze/running');
  }

  function startOver() {
    reset();
    navigate('/analyze/food');
  }

  return (
    <div className={styles.page}>
      <RecommendationHeader
        headingRef={headingRef}
        structure={result.recommendation?.structure}
        verdict={verdictLine(result, state.commodity.commodityName)}
        commodityName={state.commodity.commodityName}
        basis={conditionsSummary(state)}
        analysisId={result.analysisId}
      />

      {stale && (
        <div className={own.gap}>
          <Notice
            tone="warn"
            title="Your inputs changed since this analysis"
            actions={<Button size="sm" onClick={rerun}>Re-run analysis</Button>}
          >
            The result below reflects your previous inputs.
          </Notice>
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div className={own.gap}>
          <Notice tone="warn" title={result.warnings.length > 1 ? 'Check these before relying on the result' : 'Check this before relying on the result'}>
            {result.warnings.length > 1
              ? <ul className={own.warnList}>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              : result.warnings[0]}
          </Notice>
        </div>
      )}

      <div className={own.gap}>
        <ResultSummary result={result} />
      </div>

      <div className={own.next} data-print="hide">
        <Button variant={showDetails ? 'ghost' : 'primary'} aria-expanded={showDetails} aria-controls="result-details" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide details' : 'Why this?'}
        </Button>
        {structureId && (
          <Button variant="ghost" to={`/builder?structure=${encodeURIComponent(structureId)}`}>Customize</Button>
        )}
        <Button variant="ghost" to="/what-if">What if?</Button>
      </div>

      {showDetails && <Details result={result} onCompare={compare} />}

      <div className={own.actions} data-print="hide">
        <Button to="/analyze/report">Compare & export report <span aria-hidden="true">→</span></Button>
        <Button variant="ghost" to="/analyze/journey">Edit inputs</Button>
        <Button variant="ghost" onClick={startOver}>Start a new analysis</Button>
      </div>
    </div>
  );
}
