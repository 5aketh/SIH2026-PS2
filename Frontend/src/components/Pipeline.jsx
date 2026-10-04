import { useEffect, useRef } from 'react';
import { PIPELINE } from '../data/pipeline';
import { cx } from '../utils/cx';
import Button from './Button';
import styles from './Pipeline.module.css';

/** "How PackWise decides": the analysis pipeline, revealed stage by stage on scroll. */
export default function Pipeline() {
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !('IntersectionObserver' in window)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Hide stages only once the observer is ready, so content never gets stuck invisible.
    list.setAttribute('data-reveal', '');
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-shown', '');
          io.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.2 });
    list.querySelectorAll(':scope > li').forEach((li) => io.observe(li));
    return () => {
      io.disconnect();
      list.removeAttribute('data-reveal');
    };
  }, []);

  return (
    <section className={styles.pipeline} id="how-it-works" aria-labelledby="pipeline-title">
      <div className={cx('container', styles.grid)}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>How PackWise decides</p>
          <h2 id="pipeline-title">From food to package, one traceable step at a time</h2>
          <p className={styles.sub}>
            Every recommendation follows the same path, and each stage here is a real step of the analysis.
            Requirements come first. Materials are only named once they're known.
          </p>
          <Button to="/analyze/food" className={styles.cta}>Start packaging analysis</Button>
        </div>
        <ol className={styles.stages} ref={listRef}>
          {PIPELINE.map((stage, i) => (
            <li key={stage.title} className={styles.stage} style={{ '--i': i }}>
              <span className={styles.node} aria-hidden="true">{i + 1}</span>
              <div className={styles.body}>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
                <ul className={styles.chips} aria-label={`${stage.title}: examples`}>
                  {stage.chips.map((chip) => <li key={chip}>{chip}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
