import { Link } from 'react-router';
import styles from './WizardStepper.module.css';

/**
 * Progress through the wizard. Completed and current steps link back so
 * users can revisit them; later steps stay locked until earlier ones validate.
 */
export default function WizardStepper({ currentStep, totalSteps, steps, isReachable = () => false, isDone = () => false }) {
  const current = steps[currentStep - 1];
  return (
    <nav className={styles.stepper} aria-label="Analysis progress">
      <p className={styles.compact} aria-hidden="true">
        <span>Step {currentStep} of {totalSteps}</span> · {current?.title}
      </p>
      <div className={styles.bar} aria-hidden="true">
        <span style={{ width: `${(currentStep / totalSteps) * 100}%` }}></span>
      </div>
      <ol className={styles.list}>
        {steps.map((step, i) => {
          const n = i + 1;
          const state = n === currentStep ? 'current' : isDone(i) ? 'done' : 'upcoming';
          const content = (
            <>
              <span className={styles.num} aria-hidden="true">{state === 'done' ? '✓' : n}</span>
              <span className={styles.label}>
                {step.title}
                {state === 'done' && <span className="sr-only"> (complete)</span>}
              </span>
            </>
          );
          return (
            <li key={step.id} className={styles.item} data-state={state}>
              {n !== currentStep && isReachable(i)
                ? <Link className={styles.link} to={step.path}>{content}</Link>
                : <span className={styles.link} aria-current={n === currentStep ? 'step' : undefined} aria-disabled={n !== currentStep || undefined}>{content}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
