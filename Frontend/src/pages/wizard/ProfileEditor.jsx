import { useWizard } from '../../context/WizardContext';
import { FOOD_CATEGORIES, PROFILE_FIELDS, RESPIRATION_CLASSES, SENSITIVITY_LEVELS } from '../../data/wizard';
import { validateProfile } from '../../lib/wizardModel';
import ChoiceGroup from '../../components/wizard/ChoiceGroup';
import Field from '../../components/wizard/Field';
import Notice from '../../components/wizard/Notice';
import ProvenanceBadge from '../../components/wizard/ProvenanceBadge';
import RangeField from '../../components/wizard/RangeField';
import fieldStyles from '../../components/wizard/Field.module.css';
import styles from './Wizard.module.css';

/**
 * The selected food's properties (the "Edit values" panel on the Food step).
 * Field errors show once the user has tried to continue (`attempted`), or
 * straight away when the backend rejected a value.
 */
export default function ProfileEditor({ attempted }) {
  const { state, dispatch } = useWizard();
  const { commodity, profile, notes, fieldErrors } = state;
  const { fields, meta } = profile;
  const clientErrors = validateProfile(state);
  const errorFor = (key) => fieldErrors['commodity.profile.' + key] || (attempted ? clientErrors[key] : null);
  const badgeFor = (key) => <ProvenanceBadge value={meta[key]?.provenance} confidence={meta[key]?.confidence} />;
  const set = (field) => (value) => dispatch({ type: 'profile/set', field, value });
  const freshProduce = fields.category === 'fresh_produce' || fields.respirationClass === 'high';
  const nameError = fieldErrors['commodity.commodityName'] || (attempted ? clientErrors.commodityName : null);

  return (
    <>
      <p className={styles.sub}>
        {commodity.isCustom && profile.source
          ? 'Prefilled with example values for this food. They are estimates, so edit anything you know differs for your product.'
          : commodity.isCustom
          ? "Enter what you know about this food's properties. Leave a field empty if you're unsure. You can still continue, and the result will be flagged as lower confidence."
          : 'Typical values for this food. Edit anything that differs for your product; edited values are labelled so the result stays traceable.'}
      </p>

      {notes?.description && (
        <div className={styles.notes}>
          <Notice tone="info" title="Your description">
            <p className={styles.notesText}>“{notes.description}”</p>
            {notes.tags?.length > 0 && (
              <ul className={styles.notesTags} aria-label="Tags">
                {notes.tags.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </Notice>
        </div>
      )}

      <div className={`${styles.formGrid} ${styles.editorGrid}`}>
        {commodity.isCustom && (
          <Field id="commodity-name" label="Commodity name" error={nameError} className={styles.span2}>
            <input
              id="commodity-name"
              className={fieldStyles.input}
              type="text"
              maxLength={80}
              value={commodity.commodityName}
              aria-invalid={nameError ? 'true' : undefined}
              aria-describedby={nameError ? 'commodity-name-error' : undefined}
              onChange={(e) => dispatch({ type: 'commodity/rename', name: e.target.value })}
            />
          </Field>
        )}

        <ChoiceGroup
          className={styles.span2}
          name="profile-category"
          legend={PROFILE_FIELDS.category.label}
          options={FOOD_CATEGORIES}
          value={fields.category}
          onChange={set('category')}
          badge={badgeFor('category')}
          error={errorFor('category')}
        />

        {freshProduce && (
          <div className={styles.span2}>
            <Notice tone="info">This will activate Fresh Produce / MAP analysis.</Notice>
          </div>
        )}

        {['moisturePct', 'fatPct', 'ph'].map((key) => {
          const f = PROFILE_FIELDS[key];
          return (
            <RangeField
              key={key}
              id={'profile-' + key}
              label={f.label}
              unit={f.unit}
              min={f.min}
              max={f.max}
              step={f.step}
              value={fields[key]}
              onChange={set(key)}
              badge={badgeFor(key)}
              error={errorFor(key)}
            />
          );
        })}

        <ChoiceGroup
          name="profile-respirationClass"
          legend={PROFILE_FIELDS.respirationClass.label}
          options={RESPIRATION_CLASSES}
          value={fields.respirationClass}
          onChange={set('respirationClass')}
          badge={badgeFor('respirationClass')}
          error={errorFor('respirationClass')}
          hint="How actively the food keeps respiring after harvest."
        />
        <ChoiceGroup
          name="profile-oxidationSensitivity"
          legend={PROFILE_FIELDS.oxidationSensitivity.label}
          options={SENSITIVITY_LEVELS}
          value={fields.oxidationSensitivity}
          onChange={set('oxidationSensitivity')}
          badge={badgeFor('oxidationSensitivity')}
          error={errorFor('oxidationSensitivity')}
        />
      </div>
    </>
  );
}
