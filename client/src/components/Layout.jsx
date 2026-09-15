import { Outlet } from 'react-router-dom';
import ConnectionBanner from './ConnectionBanner.jsx';
import LiveSocial from './LiveSocial.jsx';
import Navbar from './Navbar.jsx';

export default function Layout() {
  return (
    <>
      <Navbar />
      <ConnectionBanner />
      <main>
        <Outlet />
      </main>
      <LiveSocial />
    </>
  );
}
