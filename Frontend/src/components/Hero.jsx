import { useUnpack } from '../context/UnpackContext';
import HeroCopy from './HeroCopy';
import UnpackBox from './UnpackBox';
import ScrollHint from './ScrollHint';
import FlyLayer from './FlyLayer';
import Categories from './Categories';
import styles from './Hero.module.css';

/**
 * In animated mode the hero is a tall scroll track and the stage sticks under
 * the navbar; the category grid sits absolutely inside the stage.
 */
export default function Hero() {
  const { register } = useUnpack();
  return (
    <div className={styles.hero} ref={register('hero')}>
      <div className={styles.stage} ref={register('stage')}>
        <HeroCopy />
        <UnpackBox />
        <ScrollHint />
        <FlyLayer />
        <Categories />
      </div>
    </div>
  );
}
