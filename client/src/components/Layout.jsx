import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import ConnectionBanner from './ConnectionBanner.jsx';
import LiveSocial from './LiveSocial.jsx';
import Navbar from './Navbar.jsx';
import Spinner from './ui/Spinner.jsx';
import styles from './Layout.module.css';

export default function Layout() {
  return (
    <>
      <Navbar />
      <ConnectionBanner />
      <main>
        <Suspense
          fallback={
            <div className={styles.loading}>
              <Spinner size={28} label="Loading page" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <LiveSocial />
    </>
  );
}
