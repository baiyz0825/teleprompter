import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Editor from './pages/Editor';
import TeleprompterView from './components/TeleprompterView';

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/prompter/:id" element={<TeleprompterView />} />
      </Routes>
    </>
  );
}
