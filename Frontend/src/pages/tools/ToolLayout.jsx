import { Outlet } from 'react-router';
import { USING_MOCKS } from '../../services/api';
import SkipLink from '../../components/SkipLink';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import styles from './Tools.module.css';

/** Shell for the Builder, What-If simulator and Material Explorer. */
export default function ToolLayout() {
  return (
    <>
      <SkipLink />
      <Navbar />
      <main id="main" className={styles.main}>
        <div className="container">
          {USING_MOCKS && (
            <p className={styles.mock} title="VITE_API_BASE_URL is not set, so the app is using built-in mock responses.">
              <span className={styles.mockDot} aria-hidden="true"></span>Demo data
            </p>
          )}
          <Outlet />
        </div>
      </main>
      <Footer />
    </>
  );
}
