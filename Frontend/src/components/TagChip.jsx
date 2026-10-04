import styles from './TagChip.module.css';

/** Quick-tag toggle; pressed while its tag appears in the description. */
export default function TagChip({ tag, pressed, onSelect }) {
  return (
    <button type="button" className={styles.chip} data-tag={tag} aria-pressed={pressed ? 'true' : 'false'} onClick={() => onSelect(tag)}>
      <span className={styles.check} aria-hidden="true">✓</span>{tag}
    </button>
  );
}
