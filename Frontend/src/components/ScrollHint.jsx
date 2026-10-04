import styles from './ScrollHint.module.css';

export default function ScrollHint() {
  return (
    <p className={styles.hint} aria-hidden="true">
      <span>Scroll to unpack</span>
      <span style={{ fontSize: "150%"}}>🢗</span>
    </p>
  );
}