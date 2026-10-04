import { Link } from 'react-router';
import { TOOLS } from '../data/tools';
import { cx } from '../utils/cx';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer} data-print="hide">
      <div className={cx('container', styles.inner)}>
        <span>© 2026 PackWise</span>
        <nav aria-label="Footer">
          <ul className={styles.links}>
            <li><Link to="/analyze">Packaging analysis</Link></li>
            {TOOLS.map((t) => <li key={t.to}><Link to={t.to}>{t.title}</Link></li>)}
          </ul>
        </nav>
        <span>Packaging recommendations for food makers</span>
      </div>
    </footer>
  );
}
