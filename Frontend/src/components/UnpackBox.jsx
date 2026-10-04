import { useUnpack } from '../context/UnpackContext';
import { cx } from '../utils/cx';
import BoxWall from './BoxWall';
import LeafIcon from './icons/LeafIcon';
import styles from './UnpackBox.module.css';

/**
 * Pure-CSS 3D cardboard box. The floor is the parent; walls hinge off its
 * edges. All motion comes from custom properties (--lid, --side, --fold, …)
 * that the unpack engine sets on the hero stage.
 */
export default function UnpackBox() {
  const { register } = useUnpack();
  return (
    <div className={styles.scene} aria-hidden="true" ref={register('scene')}>
      <div className={styles.cam}>
        <div className={styles.floor}>
          <div className={cx(styles.face, styles.faceIn)}></div>
          <div className={styles.marker} ref={register('marker')}></div>
          <BoxWall side="front" tape>
            <span className={styles.print}>
              <LeafIcon strokeWidth="1.8" />
              PackWise
            </span>
            <span className={styles.marks}>↑↑</span>
          </BoxWall>
          <BoxWall side="back" tape />
          <BoxWall side="left" />
          <BoxWall side="right" />
        </div>
      </div>
    </div>
  );
}
