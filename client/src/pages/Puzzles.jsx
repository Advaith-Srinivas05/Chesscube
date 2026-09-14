import { useEffect } from 'react';
import DailyCard from '../components/puzzles/DailyCard.jsx';
import PuzzleTrainer from '../components/puzzles/PuzzleTrainer.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Signed-in players get rating-matched puzzles; guests get random ones checked in the browser.
export default function Puzzles() {
  const { user, status } = useAuth();
  const mode = user ? 'rated' : 'guest';

  useEffect(() => {
    document.title = 'Puzzles · Chesscube';
    return () => {
      document.title = 'Chesscube';
    };
  }, []);

  return (
    <div className="page">
      <h1 className="sr-only">Puzzles</h1>
      {status === 'ready' && (
        <PuzzleTrainer key={mode} mode={mode}>
          <DailyCard />
        </PuzzleTrainer>
      )}
    </div>
  );
}
