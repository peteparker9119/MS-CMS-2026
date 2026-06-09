import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CContainer, CSpinner } from '@coreui/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

/* EC-03: shown for any URL the app doesn't recognise */
function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🔍</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>
        Page not found
      </div>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ink3)', maxWidth: 340 }}>
        The URL you followed doesn't exist in this application.
      </div>
      <button
        onClick={() => navigate('/dashboard', { replace: true })}
        style={{
          marginTop: 8, border: 'none', borderRadius: 10, padding: '10px 24px',
          background: 'var(--accent)', color: '#fff',
          fontFamily: 'var(--fb)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PlannerPage from './pages/PlannerPage';
import MinutesPage from './pages/MinutesPage';
import MeetingsPage from './pages/MeetingsPage';
import ItemTrackerPage from './pages/ItemTrackerPage';
import DocumentsPage from './pages/DocumentsPage';
import AdminPage from './pages/AdminPage';
import CustomMenuPage from './pages/CustomMenuPage';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import NavProgress from './components/NavProgress';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <CSpinner color="dark" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  return (
    <div>
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="app-wrapper d-flex flex-column min-vh-100">
        <AppHeader onSidebarToggle={() => setMobileOpen(o => !o)} />
        <div className="body flex-grow-1">
          <CContainer
            fluid
            style={{ maxWidth: 1340, padding: 'clamp(18px,3vw,30px) clamp(18px,4vw,44px) 60px' }}
          >
            <div key={location.pathname} className="page-enter">
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/meetings"  element={<MeetingsPage />} />
                <Route path="/planner"   element={user.role === 'admin' ? <PlannerPage /> : <Navigate to="/dashboard" replace />} />
                <Route path="/minutes"   element={user.role === 'admin' ? <MinutesPage /> : <Navigate to="/dashboard" replace />} />
                <Route path="/items"     element={<ItemTrackerPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/admin-panel" element={user.role === 'admin' ? <AdminPage /> : <Navigate to="/dashboard" replace />} />
                <Route path="/menu/:slug" element={<CustomMenuPage />} />
                <Route path="*"          element={<NotFoundPage />} />
              </Routes>
            </div>
          </CContainer>
        </div>
        <footer className="foot">MS - CMS Convergence — TN EMIS · {new Date().getFullYear()}</footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <NavProgress />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
