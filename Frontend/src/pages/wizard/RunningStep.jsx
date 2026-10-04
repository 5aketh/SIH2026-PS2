import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useWizard } from '../../context/WizardContext';
import { useAnnounce } from '../../context/AnnouncerContext';
import { ANALYSIS_STAGES, CONDITION_FIELDS, PROFILE_FIELDS, WIZARD_STEPS } from '../../data/wizard';
import { stepForField } from '../../lib/wizardModel';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import Button from '../../components/Button';
import Notice from '../../components/wizard/Notice';
import styles from './Wizard.module.css';
import own from './RunningStep.module.css';

const STAGE_MS = 650;
const FINISH_MS = 160;
// Slower when the backend reports what each stage found, so the details can be read.
const TRACE_MS = 420;

function fieldLabel(path) {
  const key = path.split('.').pop();
  return PROFILE_FIELDS[key]?.label || CONDITION_FIELDS[key]?.label || key;
}

/**
 * Screen 5. The analysis is a single fast request (spec §6.5, §7.5): the
 * stages advance on a timer and hold on the last one until the response
 * arrives. Then each stage completes in turn showing what the backend's
 * trace says it found.
 */
export default function RunningStep() {
  const { state, runAnalysis } = useWizard();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const headingRef = useFocusOnMount();
  const { status, error, result } = state.analysis;
  const [done, setDone] = useState(0); // number of completed stages
  const trace = status === 'success' ? result?.trace : null;

  useEffect(() => {
    if (status === 'running') setDone(0);
  }, [status]);

  useEffect(() => {
    if (status === 'running' && done < ANALYSIS_STAGES.length - 1) {
      const t = setTimeout(() => setDone((d) => d + 1), STAGE_MS);
      return () => clearTimeout(t);
    }
    if (status === 'success') {
      if (done < ANALYSIS_STAGES.length) {
        const t = setTimeout(() => setDone((d) => d + 1), trace ? TRACE_MS : FINISH_MS);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        announce('Analysis complete.');
        navigate('/analyze/result', { replace: true });
      }, trace ? 900 : 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, done, navigate, announce, trace]);

  useEffect(() => {
    if (status === 'error') announce('The analysis did not complete.');
  }, [status, announce]);

  // Arrived without a request in flight (e.g. a reload): go somewhere useful.
  if (status === 'idle') return <Navigate to={result ? '/analyze/result' : '/analyze/journey'} replace />;

  const name = state.commodity.commodityName;

  if (status === 'error') {
    const step = stepForField(error?.field);
    const stepPath = step && WIZARD_STEPS.find((s) => s.id === step)?.path;
    return (
      <div className={styles.page}>
        <p className={styles.eyebrow}>Analysis</p>
        <h1 className={styles.title} tabIndex={-1} ref={headingRef}>The analysis didn't complete</h1>
        <div className={styles.section}>
          <Notice
            tone="danger"
            role="alert"
            title={error?.field ? `Check ${fieldLabel(error.field)}` : 'Something went wrong'}
            actions={(
              <>
                {stepPath && <Button size="sm" to={stepPath}>Fix {fieldLabel(error.field)}</Button>}
                <Button size="sm" variant={stepPath ? 'ghost' : 'primary'} onClick={runAnalysis}>Retry analysis</Button>
                <Button size="sm" variant="ghost" to="/analyze/journey">Back to the journey</Button>
              </>
            )}
          >
            <p>{error?.message}</p>
            <p className={own.saved}>Your inputs are saved, so nothing needs to be re-entered.</p>
          </Notice>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={own.card}>
        <p className={styles.eyebrow}>Analysis in progress</p>
        <h1 className={own.title} tabIndex={-1} ref={headingRef}>Analyzing packaging{name ? ` for ${name}` : ''}</h1>
        <ol className={own.stages} aria-label="Reasoning stages">
          {ANALYSIS_STAGES.map((stage, i) => {
            const s = i < done ? 'done' : i === done ? 'active' : 'pending';
            const detail = s === 'done' && trace?.find((t) => t.stage === stage.id)?.detail;
            return (
              <li key={stage.id} className={own.stage} data-state={s}>
                <span className={own.marker} aria-hidden="true">{s === 'done' ? '✓' : ''}</span>
                <span className={own.stageText}>
                  <span>{stage.label}</span>
                  <span className="sr-only">{s === 'done' ? ' (done)' : s === 'active' ? ' (in progress)' : ''}</span>
                  {detail && <span className={own.detail}>{detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className={own.note}>
          {trace ? 'Each line is what that stage of the analysis found.' : 'The analysis runs as a single request; stage timing is illustrative until it returns.'}
        </p>
      </div>
    </div>
  );
}
