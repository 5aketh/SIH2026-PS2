import { useUnpack } from '../context/UnpackContext';
import { CATEGORIES } from '../data/categories';
import { cx } from '../utils/cx';
import CategoryCard from './CategoryCard';
import styles from './Categories.module.css';

export default function Categories() {
  const { register, jumpToGrid, isAssembling } = useUnpack();

  // Keyboard users tabbing into a card mid-animation get the resolved grid.
  function handleFocus(e) {
    if (isAssembling() && e.target.id !== 'cats-title') jumpToGrid(false);
  }

  return (
    <section className={styles.cats} id="categories" aria-labelledby="cats-title" ref={register('cats')} onFocus={handleFocus}>
      <div className={cx(styles.inner, 'container')} ref={register('catsInner')}>
        <div className={styles.head}>
          <h2 id="cats-title" tabIndex={-1} ref={register('catsHeading')}>Start with a food category</h2>
          <p>Pick the closest match and we'll guide you to the right materials and format.</p>
        </div>
        <ul className={styles.grid}>
          {CATEGORIES.map((category, i) => (
            <CategoryCard key={category.id} category={category} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
