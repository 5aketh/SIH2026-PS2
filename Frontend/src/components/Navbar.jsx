import { Link, NavLink } from 'react-router';
import { useJumpToGrid, useUnpack } from '../context/UnpackContext';
import { TOOLS } from '../data/tools';
import { cx } from '../utils/cx';
import Button from './Button';
import ThemeToggle from './ThemeToggle';
import LeafIcon from './icons/LeafIcon';
import styles from './Navbar.module.css';

/** On the landing page it drives the unpack animation; in the wizard it links home. */
export default function Navbar() {
  const unpack = useUnpack();
  const onJump = useJumpToGrid();
  const logo = (
    <>
      <LeafIcon aria-hidden="true" />
      <span>PackWise</span>
    </>
  );
  return (
    <header className={styles.nav} id="top" ref={unpack?.register('nav')} data-print="hide">
      <div className={cx('container', styles.inner)}>
        {unpack
          ? <a className={styles.logo} href="#top" aria-label="PackWise home">{logo}</a>
          : <Link className={styles.logo} to="/" aria-label="PackWise home">{logo}</Link>}
        <nav className={styles.links} aria-label="Tools">
          <NavLink to="/analyze" className={styles.link}>Analyze</NavLink>
          {TOOLS.map((t) => <NavLink key={t.to} to={t.to} className={styles.link}>{t.nav}</NavLink>)}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
