import { cx } from '../utils/cx';
import Steps from './Steps';
import CustomForm from './CustomForm';
import styles from './CustomPackaging.module.css';

export default function CustomPackaging() {
  return (
    <section className={styles.custom} id="custom" aria-labelledby="custom-title">
      <div className={cx('container', styles.grid)}>
        <div>
          <h2 id="custom-title">Have something specific in mind?</h2>
          <p className={styles.sub}>Describe your product and we'll build a recommendation from scratch.</p>
          <Steps />
        </div>
        <CustomForm />
      </div>
    </section>
  );
}
