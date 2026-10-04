import { STEPS } from '../data/steps';
import styles from './Steps.module.css';

export default function Steps() {
  return (
    <ol className={styles.steps}>
      {STEPS.map(({ title, text }) => (
        <li key={title}><div><h3>{title}</h3><p>{text}</p></div></li>
      ))}
    </ol>
  );
}
