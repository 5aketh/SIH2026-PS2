import { cx } from '../../utils/cx';
import styles from './Notice.module.css';

/** Inline banner. `tone`: info | warn | danger. */
export default function Notice({ tone = 'info', title, children, actions, role, className }) {
  return (
    <div className={cx(styles.notice, className)} data-tone={tone} role={role}>
      <span className={styles.icon} aria-hidden="true">{tone === 'info' ? 'i' : '!'}</span>
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
