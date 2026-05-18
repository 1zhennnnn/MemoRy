import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAccessToken } from './shared/auth';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import NewNotePage from './pages/NewNotePage';
import TimelinePage from './pages/TimelinePage';
import SearchPage from './pages/SearchPage';
import NotePage from './pages/NotePage';
import ReportsPage from './pages/ReportsPage';
import ReportDetailPage from './pages/ReportDetailPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/timeline" replace />} />
          <Route path="new" element={<NewNotePage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="notes/:id" element={<NotePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/:date" element={<ReportDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
