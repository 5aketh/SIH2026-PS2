import { useTheme } from '../hooks/useTheme';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import styles from './ThemeToggle.module.css';

/** The icon shows the mode the button switches to. */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme !== 'light';
  return (
    <button
      className={styles.iconBtn}
      type="button"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
