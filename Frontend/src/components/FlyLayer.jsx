import { useUnpack } from '../context/UnpackContext';
import { CATEGORIES } from '../data/categories';
import { cx } from '../utils/cx';
import tile from '../styles/iconTile.module.css';
import styles from './FlyLayer.module.css';

/**
 * Floating copies of each card's icon. The unpack engine moves them out of
 * the box, around it, and into their card, then hands off to the real icon.
 */
export default function FlyLayer() {
  const { register } = useUnpack();
  return (
    <div className={styles.layer} aria-hidden="true">
      {CATEGORIES.map(({ id, Icon }, i) => (
        <div key={id} className={cx(tile.tile, styles.token)} data-cat={id} ref={register('tokens', i)}>
          <Icon />
        </div>
      ))}
    </div>
  );
}
