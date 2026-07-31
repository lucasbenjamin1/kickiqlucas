import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Record from './pages/Record';
import Sessions from './pages/Sessions';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Athletes from './pages/Athletes';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/record" element={<Record />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/athletes" element={<Athletes />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
