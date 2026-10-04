import Button from '../Button';
import styles from './StepActions.module.css';

/** Back / next row at the bottom of each wizard step. */
export default function StepActions({ backTo, backLabel = 'Back', nextLabel = 'Next', onNext, nextType = 'button', nextDisabled, children }) {
  return (
    <div className={styles.actions} data-print="hide">
      {backTo ? <Button to={backTo} variant="ghost"><span aria-hidden="true">←</span> {backLabel}</Button> : <span></span>}
      <div className={styles.right}>
        {children}
        {nextLabel && (
          <Button type={nextType} onClick={onNext} disabled={nextDisabled}>
            {nextLabel} <span aria-hidden="true">→</span>
          </Button>
        )}
      </div>
    </div>
  );
}
