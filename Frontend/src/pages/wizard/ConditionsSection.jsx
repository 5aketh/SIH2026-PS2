import { useWizard } from '../../context/WizardContext';
import { CONDITION_FIELDS, STORAGE_TYPES, TRANSPORT_MODES, TRANSPORT_STRESS } from '../../data/wizard';
import { validateConditions } from '../../lib/wizardModel';
import { storageErrors, storageHint } from '../../lib/storage';
import ThermometerIcon from '../../components/icons/ThermometerIcon';
import TruckIcon from '../../components/icons/TruckIcon';
import ChoiceGroup from '../../components/wizard/ChoiceGroup';
import NumberField from '../../components/wizard/NumberField';
import RangeField from '../../components/wizard/RangeField';
import styles from './Wizard.module.css';

export const CONDITION_ORDER = ['storageType', 'temperatureC', 'relativeHumidityPct', 'targetShelfLifeDays', 'transportMode', 'transportStress'];

/**
 * Storage and transport inputs on the Journey step. Unsupported storage for
 * the food is explained straight away; other checks show once the user has
 * tried to continue (`attempted`).
 */
export default function ConditionsSection({ attempted, onSubmit }) {
  const { state, dispatch, storageRule } = useWizard();
  const c = state.conditions;
  const clientErrors = validateConditions(c, storageRule);
  const storageProblem = storageErrors(storageRule, c);
  const errorFor = (key) => state.fieldErrors['conditions.' + key] || storageProblem[key] || (attempted ? clientErrors[key] : null);
  const set = (field) => (value) => dispatch({ type: 'conditions/set', field, value });
  const num = (key) => {
    const f = CONDITION_FIELDS[key];
    return { id: 'cond-' + key, label: f.label, unit: f.unit, min: f.min, max: f.max, step: f.step, value: c[key], onChange: set(key), error: errorFor(key) };
  };

  return (
    <form className={styles.section} noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <section className={styles.panel} aria-labelledby="storage-title">
        <div className={styles.panelHead}>
          <span className={styles.panelIcon} aria-hidden="true"><ThermometerIcon /></span>
          <div>
            <h2 className={styles.panelTitle} id="storage-title">Storage</h2>
            <p className={styles.panelSub}>Environment and target shelf life.</p>
          </div>
        </div>
        <div className={styles.formGrid}>
          <ChoiceGroup
            className={styles.span2}
            name="cond-storageType"
            legend={CONDITION_FIELDS.storageType.label}
            options={STORAGE_TYPES}
            value={c.storageType}
            onChange={set('storageType')}
            hint={storageHint(storageRule)}
            error={errorFor('storageType')}
          />
          <NumberField {...num('temperatureC')} placeholder="e.g. 12" />
          <NumberField {...num('targetShelfLifeDays')} placeholder="e.g. 20" />
          <RangeField {...num('relativeHumidityPct')} className={styles.span2} />
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="transport-title">
        <div className={styles.panelHead}>
          <span className={styles.panelIcon} aria-hidden="true"><TruckIcon /></span>
          <div>
            <h2 className={styles.panelTitle} id="transport-title">Transport</h2>
            <p className={styles.panelSub}>How the product travels and how rough the handling is.</p>
          </div>
        </div>
        <div className={styles.formGrid}>
          <ChoiceGroup
            className={styles.span2}
            name="cond-transportMode"
            legend={CONDITION_FIELDS.transportMode.label}
            options={TRANSPORT_MODES}
            value={c.transportMode}
            onChange={set('transportMode')}
            error={errorFor('transportMode')}
          />
          <ChoiceGroup
            className={styles.span2}
            name="cond-transportStress"
            legend={CONDITION_FIELDS.transportStress.label}
            options={TRANSPORT_STRESS}
            value={c.transportStress}
            onChange={set('transportStress')}
            error={errorFor('transportStress')}
            hint="High means long or rough transport, with more handling, vibration and stacking."
          />
        </div>
      </section>
      <button type="submit" hidden>Analyze</button>
    </form>
  );
}
