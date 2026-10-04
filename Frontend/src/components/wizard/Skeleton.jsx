import { cx } from '../../utils/cx';
import styles from './Skeleton.module.css';

/** Placeholder block shown while data loads (never a blank screen). */
export default function Skeleton({ height = 16, width = '100%', radius, className }) {
  return <span className={cx(styles.skeleton, className)} style={{ height, width, borderRadius: radius }} aria-hidden="true"></span>;
}
