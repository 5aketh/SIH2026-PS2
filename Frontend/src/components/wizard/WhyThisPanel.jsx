import styles from './Result.module.css';

/** The backend's explanation strings, rendered verbatim and never paraphrased. */
export default function WhyThisPanel({ reasons, title = 'Why this?' }) {
  return (
    <section className={styles.panel} aria-labelledby="why-title">
      <h2 className={styles.panelTitle} id="why-title">{title}</h2>
      <p className={styles.panelSub}>Key drivers behind the requirements and the chosen structure.</p>
      {reasons?.length ? (
        <ul className={styles.why}>
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      ) : (
        <p className={styles.empty}>No explanation was returned for this analysis.</p>
      )}
    </section>
  );
}
