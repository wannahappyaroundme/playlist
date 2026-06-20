import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlaybackProvider } from './playback/PlaybackContext';
import Gallery from './pages/Gallery';
import Player from './pages/Player';
import Editor from './pages/Editor';
import SharedView from './pages/SharedView';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

export default function App() {
  return (
    <HashRouter>
      <PlaybackProvider>
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/p/:playlistId" element={<Player />} />
          <Route path="/p/:playlistId/:songId" element={<Player />} />
          <Route path="/edit/:playlistId" element={<Editor />} />
          <Route path="/s/:encoded" element={<SharedView />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PlaybackProvider>
    </HashRouter>
  );
}
