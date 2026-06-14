import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CContainer, CSpinner } from '@coreui/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🔍</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>Page not found</div>
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
      >Go to Dashboard</button>
    </div>
  );
}

import LoginPage       from './pages/LoginPage';
import DashboardPage   from './pages/DashboardPage';
import PlannerPage     from './pages/PlannerPage';
import MinutesPage     from './pages/MinutesPage';
import MeetingsPage    from './pages/MeetingsPage';
import ItemTrackerPage from './pages/ItemTrackerPage';
import DocumentsPage   from './pages/DocumentsPage';
import WorkLogPage     from './pages/WorkLogPage';
import ReviewsPage     from './pages/ReviewsPage';
import AdminPage       from './pages/AdminPage';
import CustomMenuPage  from './pages/CustomMenuPage';
import AppSidebar      from './components/AppSidebar';
import AppHeader       from './components/AppHeader';
import NavProgress     from './components/NavProgress';

// Role helpers
const isAdmin     = r => ['super_admin','admin'].includes(r);
const isTeamRole  = r => ['super_admin','poc','team'].includes(r);

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return null;
  return roles.includes(user.role) ? children : <Navigate to="/dashboard" replace />;
}

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
  if (!user) return null;

  return (
    <div>
      <AppHeader />
      <AppSidebar />
      <div className="app-wrapper d-flex flex-column min-vh-100">
        <div className="body flex-grow-1">
          <CContainer fluid style={{ maxWidth: 1340, padding: 'clamp(18px,3vw,30px) clamp(18px,4vw,44px) 60px' }}>
            <div key={location.pathname} className="page-enter">
              <Routes>
                {/* All roles */}
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/meetings"  element={<MeetingsPage />} />
                <Route path="/items"     element={<ItemTrackerPage />} />
                <Route path="/documents" element={<DocumentsPage />} />

                {/* super_admin + admin only */}
                <Route path="/planner" element={
                  <Guard roles={['super_admin','admin']}><PlannerPage /></Guard>
                }/>
                <Route path="/minutes" element={
                  <Guard roles={['super_admin','admin']}><MinutesPage /></Guard>
                }/>
                <Route path="/admin-panel" element={
                  <Guard roles={['super_admin','admin']}><AdminPage /></Guard>
                }/>

                {/* super_admin + poc + team */}
                <Route path="/worklog" element={
                  <Guard roles={['super_admin','poc','team']}><WorkLogPage /></Guard>
                }/>
                <Route path="/reviews" element={
                  <Guard roles={['super_admin','poc','team']}><ReviewsPage /></Guard>
                }/>

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
              <ProtectedRoute><AppLayout /></ProtectedRoute>
            }/>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
