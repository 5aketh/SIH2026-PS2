import styles from './Result.module.css';

/** The recommended structure and a one-line verdict. Confidence sits with the headline numbers below. */
export default function RecommendationHeader({ structure, verdict, commodityName, basis, analysisId, headingRef }) {
  return (
    <header className={styles.recHeader}>
      <p className={styles.eyebrow}>Recommended packaging structure{commodityName && <> for <strong>{commodityName}</strong></>}</p>
      <div className={styles.recTitleRow}>
        <h1 className={styles.recTitle} tabIndex={-1} ref={headingRef}>{structure}</h1>
      </div>
      {verdict && <p className={styles.verdict}>{verdict}</p>}
      {basis && <p className={styles.basis}>Based on {basis}</p>}
      {analysisId && <p className={styles.analysisId}>Analysis {analysisId}</p>}
    </header>
  );
}
