import { Navigate, Route, Routes } from 'react-router-dom';
import GuestOnly from './components/GuestOnly.jsx';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Analysis from './pages/Analysis.jsx';
import ChooseUsername from './pages/ChooseUsername.jsx';
import DailyPuzzle from './pages/DailyPuzzle.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Home from './pages/Home.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Learn from './pages/Learn.jsx';
import Lesson from './pages/Lesson.jsx';
import Play from './pages/Play.jsx';
import PlayComputer from './pages/PlayComputer.jsx';
import Profile from './pages/Profile.jsx';
import Puzzles from './pages/Puzzles.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Settings from './pages/Settings.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import Socials from './pages/Socials.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';

const guest = (page) => <GuestOnly>{page}</GuestOnly>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="play" element={<Play />} />
        <Route path="play/computer" element={<PlayComputer />} />
        <Route path="puzzles" element={<Puzzles />} />
        <Route path="puzzles/daily" element={<RequireAuth><DailyPuzzle /></RequireAuth>} />
        <Route path="learn" element={<Learn />} />
        <Route path="learn/analysis/:gameId?" element={<Analysis />} />
        <Route path="learn/lessons/:lessonId" element={<Lesson />} />
        <Route path="leaderboard/:category?" element={<Leaderboard />} />
        <Route path="socials" element={<Socials />} />
        <Route path="signin" element={guest(<SignIn />)} />
        <Route path="signup" element={guest(<SignUp />)} />
        <Route path="signup/username" element={guest(<ChooseUsername />)} />
        <Route path="verify-email" element={guest(<VerifyEmail />)} />
        <Route path="forgot-password" element={guest(<ForgotPassword />)} />
        <Route path="reset-password" element={guest(<ResetPassword />)} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="u/:username" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
