import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import GuestOnly from './components/GuestOnly.jsx';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Home from './pages/Home.jsx';

// Home is in the main bundle (the landing page); every other page loads on first visit.
const Analysis = lazy(() => import('./pages/Analysis.jsx'));
const ChooseUsername = lazy(() => import('./pages/ChooseUsername.jsx'));
const DailyPuzzle = lazy(() => import('./pages/DailyPuzzle.jsx'));
const Game = lazy(() => import('./pages/Game.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const LinkGoogle = lazy(() => import('./pages/LinkGoogle.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Learn = lazy(() => import('./pages/Learn.jsx'));
const Lesson = lazy(() => import('./pages/Lesson.jsx'));
const Play = lazy(() => import('./pages/Play.jsx'));
const PlayComputer = lazy(() => import('./pages/PlayComputer.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Puzzles = lazy(() => import('./pages/Puzzles.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const SignIn = lazy(() => import('./pages/SignIn.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const Socials = lazy(() => import('./pages/Socials.jsx'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'));

const guest = (page) => <GuestOnly>{page}</GuestOnly>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="play" element={<Play />} />
        <Route path="play/computer" element={<PlayComputer />} />
        <Route path="game/:id" element={<Game />} />
        <Route path="puzzles" element={<Puzzles />} />
        <Route path="puzzles/daily" element={<RequireAuth><DailyPuzzle /></RequireAuth>} />
        <Route path="learn" element={<Learn />} />
        <Route path="learn/analysis/:gameId?" element={<Analysis />} />
        <Route path="learn/lessons/:lessonId" element={<Lesson />} />
        <Route path="leaderboard/:category?" element={<Leaderboard />} />
        <Route path="socials" element={<Socials />} />
        <Route path="signin" element={guest(<SignIn />)} />
        <Route path="signin/link-google" element={guest(<LinkGoogle />)} />
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
