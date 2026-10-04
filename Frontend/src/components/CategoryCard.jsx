import { useAnnounce } from '../context/AnnouncerContext';
import { useUnpack } from '../context/UnpackContext';
import { startCategory } from '../services/packwise';
import { cx } from '../utils/cx';
import Button from './Button';
import tile from '../styles/iconTile.module.css';
import styles from './CategoryCard.module.css';

export default function CategoryCard({ category, index }) {
  const { register, jumpToGrid, isAssembling } = useUnpack();
  const announce = useAnnounce();
  const { id, title, description, Icon } = category;

  function handleStart() {
    // Cards only become clickable once the grid has resolved.
    if (isAssembling()) {
      jumpToGrid(false);
      return;
    }
    announce('Starting with ' + title);
    startCategory(id);
  }

  return (
    <li className={styles.card} data-cat={id} ref={register('cards', index)}>
      <span className={cx(tile.tile, styles.icon)} aria-hidden="true" ref={register('cardIcons', index)}>
        <Icon />
      </span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.desc}>{description}</p>
      <Button variant="ghost" size="sm" className={styles.cta} data-category={id} onClick={handleStart}>
        Start here<span className="sr-only">{` with ${title}`}</span>{' '}<span aria-hidden="true">→</span>
      </Button>
    </li>
  );
}
