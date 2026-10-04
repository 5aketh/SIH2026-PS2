import { cx } from '../utils/cx';
import styles from './UnpackBox.module.css';

/**
 * One wall of the box, hinged off an edge of the floor, carrying its top flap.
 * Each panel has an inner face and a flipped outer face (backfaces hidden).
 */
export default function BoxWall({ side, children, tape = false }) {
  return (
    <div className={cx(styles.wall, styles[side])}>
      <div className={cx(styles.face, styles.faceIn)}></div>
      <div className={cx(styles.face, styles.faceOut)}>{children}</div>
      <div className={styles.flap}>
        <div className={cx(styles.face, styles.faceIn)}></div>
        <div className={cx(styles.face, styles.faceOut)}>{tape && <span className={styles.tape}></span>}</div>
      </div>
    </div>
  );
}
