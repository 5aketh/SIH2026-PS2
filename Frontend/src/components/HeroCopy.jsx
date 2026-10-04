import { useJumpToGrid } from '../context/UnpackContext';
import { cx } from '../utils/cx';
import Button from './Button';
import styles from './HeroCopy.module.css';

export default function HeroCopy() {
  const onJump = useJumpToGrid();
  return (
    <div className={cx(styles.copy, 'container')}>
      <h1>Packaging that fits what's inside</h1>
      <p className={styles.sub}>Tell PackWise what you're packing. Get barrier, film and format recommendations matched to your product, shelf life and budget.</p>
      <div className={styles.ctas}>
        <Button href="#categories" data-jump="categories" onClick={onJump}>Browse categories</Button>
        <Button href="#custom" variant="ghost">Describe your product</Button>
      </div>
    </div>
  );
}
