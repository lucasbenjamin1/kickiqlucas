import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Record from './pages/Record';
import Sessions from './pages/Sessions';
import Tendencies from './pages/Tendencies';
import Reports from './pages/Reports';
import Athletes from './pages/Athletes';
import AthleteProfile from './pages/AthleteProfile';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected app routes */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Home />} />
          <Route path="/record" element={<Record />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/tendencies" element={<Tendencies />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/athletes" element={<Athletes />} />
          <Route path="/athletes/:id" element={<AthleteProfile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
