import { Link } from 'react-router';
import { TOOLS } from '../data/tools';
import { cx } from '../utils/cx';
import styles from './ToolsSection.module.css';

/** Landing-page entry points to the tools beside the analysis wizard. */
export default function ToolsSection() {
  return (
    <section className={styles.tools} aria-labelledby="tools-title">
      <div className="container">
        <p className={styles.eyebrow}>Go further</p>
        <h2 id="tools-title" className={styles.title}>Explore beyond one recommendation</h2>
        <ul className={styles.grid}>
          {TOOLS.map((t) => (
            <li key={t.to} className={styles.card}>
              <h3><Link className={styles.link} to={t.to}>{t.title}</Link></h3>
              <p>{t.text}</p>
              <span className={cx(styles.go)} aria-hidden="true">Open →</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
