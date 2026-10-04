import { useJumpToGrid, useUnpack } from '../context/UnpackContext';
import styles from './SkipLink.module.css';

export default function SkipLink() {
  const unpack = useUnpack();
  const onJump = useJumpToGrid();
  if (!unpack) {
    return <a className={styles.skipLink} href="#main">Skip to content</a>;
  }
  return (
    <a className={styles.skipLink} href="#categories" data-jump="categories" onClick={onJump}>
      Skip to categories
    </a>
  );
}
