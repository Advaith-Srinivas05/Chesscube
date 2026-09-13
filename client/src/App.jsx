import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Learn from './pages/Learn.jsx';
import Play from './pages/Play.jsx';
import Profile from './pages/Profile.jsx';
import Puzzles from './pages/Puzzles.jsx';
import Settings from './pages/Settings.jsx';
import SignIn from './pages/SignIn.jsx';
import Socials from './pages/Socials.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="play" element={<Play />} />
        <Route path="puzzles" element={<Puzzles />} />
        <Route path="learn" element={<Learn />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="socials" element={<Socials />} />
        <Route path="signin" element={<SignIn />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
