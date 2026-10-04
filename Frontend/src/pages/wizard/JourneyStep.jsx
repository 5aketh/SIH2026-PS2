import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useWizard } from '../../context/WizardContext';
import { useAnnounce } from '../../context/AnnouncerContext';
import { validateConditions } from '../../lib/wizardModel';
import { useFocusOnMount } from '../../hooks/useFocusOnMount';
import StepActions from '../../components/wizard/StepActions';
import ConditionsSection, { CONDITION_ORDER } from './ConditionsSection';
import PrioritiesSection from './PrioritiesSection';
import styles from './Wizard.module.css';

/** Step 2: where the food is stored and transported, and what matters most. */
export default function JourneyStep() {
  const { state, runAnalysis, storageRule } = useWizard();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const headingRef = useFocusOnMount();
  const [attempted, setAttempted] = useState(false);

  function analyze() {
    setAttempted(true);
    const errors = validateConditions(state.conditions, storageRule);
    const first = CONDITION_ORDER.find((k) => errors[k]);
    if (first) {
      announce('Please fix the highlighted fields.');
      const el = document.getElementById('cond-' + first) || document.querySelector(`input[name="cond-${first}"]`);
      el?.focus();
      return;
    }
    runAnalysis();
    navigate('/analyze/running');
  }

  const name = state.commodity.commodityName;
  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Step 2 of 3</p>
      <h1 className={styles.title} tabIndex={-1} ref={headingRef}>The journey{name ? ` for ${name}` : ''}</h1>
      <p className={styles.sub}>
        Where the packed food will sit, how long it needs to last, what the trip looks like, and what matters most in the package.
      </p>
      <ConditionsSection attempted={attempted} onSubmit={analyze} />
      <PrioritiesSection />
      <StepActions backTo="/analyze/food" nextLabel="Analyze packaging" onNext={analyze} />
    </div>
  );
}
