import { useRef, useState } from 'react';
import { QUICK_TAGS } from '../data/quickTags';
import { startCustom } from '../services/packwise';
import { appendTag, hasTag, MAX_DESCRIPTION } from '../utils/tags';
import { cx } from '../utils/cx';
import Button from './Button';
import TagChip from './TagChip';
import styles from './CustomForm.module.css';

export default function CustomForm() {
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [showError, setShowError] = useState(false);
  const textareaRef = useRef(null);

  const length = description.length;
  const activeTags = QUICK_TAGS.filter((tag) => hasTag(description, tag));

  function updateDescription(value) {
    setDescription(value);
    if (value.trim()) setShowError(false);
  }

  function handleChange(e) {
    setStatus('');
    updateDescription(e.target.value);
  }

  function handleTag(tag) {
    if (hasTag(description, tag)) return;
    const next = appendTag(description, tag);
    if (next === null) {
      setStatus(`Not enough room to add "${tag}".`);
      return;
    }
    setStatus('');
    updateDescription(next);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const value = description.trim();
    if (!value) {
      setShowError(true);
      setStatus('');
      textareaRef.current.focus();
      return;
    }
    setShowError(false);
    setStatus('Starting your analysis…');
    startCustom({ description: value, tags: activeTags });
  }

  return (
    <form className={styles.formCard} id="custom-form" noValidate onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor="desc">Describe your product</label>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        id="desc"
        name="description"
        maxLength={MAX_DESCRIPTION}
        rows={5}
        placeholder="e.g. Cold-pressed mango juice in 250 ml bottles, no preservatives, needs 30 days chilled shelf life for supermarkets."
        aria-describedby="desc-hint desc-count desc-error"
        aria-invalid={showError ? 'true' : undefined}
        value={description}
        onChange={handleChange}
      />
      <div className={styles.meta}>
        <p id="desc-hint">Include what it is, how it's stored and how long it needs to last.</p>
        <span
          id="desc-count"
          className={cx(
            styles.counter,
            length >= MAX_DESCRIPTION * 0.85 && length < MAX_DESCRIPTION && styles.near,
            length >= MAX_DESCRIPTION && styles.full,
          )}
        >
          {`${length} / ${MAX_DESCRIPTION}`}
        </span>
      </div>
      <p id="desc-error" className={styles.error} hidden={!showError}>Please describe your product before starting the analysis.</p>

      <fieldset className={styles.chips}>
        <legend>Quick tags</legend>
        <div className={styles.chipsList}>
          {QUICK_TAGS.map((tag) => (
            <TagChip key={tag} tag={tag} pressed={activeTags.includes(tag)} onSelect={handleTag} />
          ))}
        </div>
      </fieldset>

      <Button type="submit" block className={styles.submit}>Analyse my product</Button>
      <p className={styles.status} id="form-status" role="status" aria-live="polite">{status}</p>
    </form>
  );
}
